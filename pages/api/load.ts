import { NextApiRequest, NextApiResponse } from 'next';
import { createAppExtension, getAppExtensions, removeDuplicateAppExtensions } from '@lib/appExtensions';
import db from '@lib/db';
import { encodePayload, getBCVerify, setSession } from '../../lib/auth';
import { ensureWebhookExists } from '../../lib/webhooks';

// Smart cache - only cache app extensions, always check webhooks
const appExtensionCache = new Map<string, { hasExtension: boolean; expiresAt: number }>();

const buildRedirectUrl = (url: string, encodedContext: string) => {
    const [path, query = ''] = url.split('?');
    const queryParams = new URLSearchParams(
        `context=${encodedContext}&${query}`
    );

    return `${path}?${queryParams}`;
};

export default async function load(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Verify when app loaded (launch)
        const session = await getBCVerify(req.query);
        const encodedContext = encodePayload(session); // Signed JWT to validate/ prevent tampering

        const { sub } = session;
        const storeHash = sub?.split('/')[1] || '';

        const accessToken = await db.getStoreToken(storeHash);

        await setSession(session);

        /**
         * For stores that do not have app extensions installed yet, create app extensions when app is
         * loaded
         */

        const isAppExtensionsScopeEnabled = await db.hasAppExtensionsScope(storeHash);

        if (!isAppExtensionsScopeEnabled) {
          console.warn(
            "WARNING: App extensions scope is not enabled yet. To register app extensions update the scope in Developer Portal: https://devtools.bigcommerce.com");
          
          return res.redirect(302, buildRedirectUrl(session.url, encodedContext));
        }

        // Check cache for app extensions only (not webhooks)
        const cacheKey = `app_extension_${storeHash}`;
        const cached = appExtensionCache.get(cacheKey);
        let hasOurAppExtension;

        if (cached && cached.expiresAt > Date.now()) {
          console.log('Using cached app extension status for store:', storeHash);
          hasOurAppExtension = cached.hasExtension;
        } else {
          console.log('Checking app extensions via GraphQL for store:', storeHash);
          
          const existingAppExtensions = await fetch(
              `https://${process.env.API_URL}/stores/${storeHash}/graphql`,
              {
                  method: 'POST',
                  headers: {
                      accept: 'application/json',
                      'content-type': 'application/json',
                      'x-auth-token': accessToken,
                  },
                  body: JSON.stringify(getAppExtensions()),
              }
          );

          let data;
          try {
              if (!existingAppExtensions.ok) {
                  console.error(`GraphQL API error: ${existingAppExtensions.status} ${existingAppExtensions.statusText}`);
                  const errorText = await existingAppExtensions.text();
                  console.error('GraphQL API response:', errorText);
                  // If still rate limited after retries, skip app extension check
                  if (existingAppExtensions.status === 429) {
                      console.warn('Still rate limited after retries, skipping app extension check');
                      data = { store: { appExtensions: { edges: [] } } };
                  } else {
                      throw new Error(`GraphQL API failed: ${existingAppExtensions.status}`);
                  }
              } else {
                  const responseText = await existingAppExtensions.text();
                  if (!responseText.trim()) {
                      console.error('Empty response from GraphQL API');
                      data = { store: { appExtensions: { edges: [] } } };
                  } else {
                      const parsed = JSON.parse(responseText);
                      data = parsed.data || { store: { appExtensions: { edges: [] } } };
                  }
              }
          } catch (parseError) {
              console.error('Failed to parse GraphQL response:', parseError);
              console.error('Raw response:', await existingAppExtensions.text().catch(() => 'Could not read response'));
              // Fallback to assuming no app extensions exist
              data = { store: { appExtensions: { edges: [] } } };
          }

          const existingAppExtensionIds = data?.store?.appExtensions?.edges;

          // Check if we already have our specific app extension installed
          // Look for app extensions with our specific URL pattern
          hasOurAppExtension = existingAppExtensionIds?.some((edge: any) => 
              edge?.node?.url?.includes('/productAppExtension/')
          );

          // Cache the app extension result for 1 hour
          appExtensionCache.set(cacheKey, {
            hasExtension: hasOurAppExtension,
            expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
          });
        }

        // Skip duplicate cleanup on every load - only create if needed
        if (!hasOurAppExtension) {
          console.log('Creating app extension for store:', storeHash);
          await createAppExtension({ accessToken, storeHash });
        } else {
          console.log('App extension already exists for store:', storeHash);
          // Remove any duplicate app extensions
          try {
            const extensionCount = await removeDuplicateAppExtensions({ accessToken, storeHash });
            if (extensionCount > 1) {
              console.log(`Cleaned up ${extensionCount - 1} duplicate app extension(s) for store: ${storeHash}`);
            }
          } catch (error) {
            console.error('Error removing duplicate app extensions:', error);
          }
        }

        // Always check and ensure webhooks are active on every app load
        try {
            await ensureWebhookExists({ accessToken, storeHash });
        } catch (webhookError) {
            // Log webhook creation error but don't fail the app load
            console.error('Failed to ensure webhook exists during app load:', webhookError);
        }

        res.redirect(302, buildRedirectUrl(session.url, encodedContext));
    } catch (error) {
        const { message, response } = error;
        res.status(response?.status || 500).json({ message });
    }
}
