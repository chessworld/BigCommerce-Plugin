import { NextApiRequest, NextApiResponse } from 'next';
import { createAppExtension } from '@lib/appExtensions';
import { encodePayload, getBCAuth, setSession } from '../../lib/auth';
import { ensureWebhookExists } from '../../lib/webhooks';

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
    const isAppExtensionsScopeEnabled = req.query.scope.includes('store_app_extensions_manage');

    try {
        // Authenticate the app on install
        const session = await getBCAuth(req.query);
        const encodedContext = encodePayload(session); // Signed JWT to validate/ prevent tampering
        const { access_token: accessToken, context } = session;

        const storeHash = context?.split('/')[1] || '';

        await setSession(session);
        // eslint-disable-next-line no-console
        console.log('Session:', session)

        /**
         * For stores that do not have the app installed yet, create App Extensions when app is
         * installed. This is the ONLY place where app extensions should be created.
         */

        if (isAppExtensionsScopeEnabled) {
            try {
                await createAppExtension({ accessToken, storeHash });
                console.log(`✓ App extension created successfully for store: ${storeHash}`);
            } catch (error) {
                // If creation fails due to duplicate, log but don't fail installation
                console.error('Failed to create app extension during installation:', error);
                // App can still function, extension can be created manually if needed
            }
        } else {
            console.warn("WARNING: App extensions scope is not enabled yet. To register app extensions update the scope in Developer Portal: https://devtools.bigcommerce.com");
        }

        // Create webhook for order events
        try {
            await ensureWebhookExists({ accessToken, storeHash });
        } catch (webhookError) {
            // Log webhook creation error but don't fail the installation
            console.error('Failed to create webhook during installation:', webhookError);
        }

        res.redirect(302, `/?context=${encodedContext}`);
    } catch (error) {
        const { message, response } = error;
        res.status(response?.status || 500).json({ message });
    }
}
