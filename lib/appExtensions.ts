export const createAppExtension = async ({ accessToken, storeHash }: { accessToken: string, storeHash: string }) => {
    const response = await fetch(
        `https://${process.env.API_URL}/stores/${storeHash}/graphql`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-auth-token": accessToken,
          },
          body: JSON.stringify(createAppExtensionMutation()),
        }
    );

    const { errors } = await response.json();
  
    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message);
    }
}

//  Builds the GraphQL mutation required to create a new App Extension
export function createAppExtensionMutation() {
    const body = {
        query: `
        mutation AppExtension($input: CreateAppExtensionInput!) {
            appExtension {
                createAppExtension(input: $input) {
                appExtension {
                    id
                    context
                    label {
                    defaultValue
                    locales {
                        value
                        localeCode
                        }
                    }
                    model
                    url
                    }
                }
            }
        }`,
        variables: {
            input: {
                context: 'PANEL',
                model: 'PRODUCTS',
                url: '/productAppExtension/${id}',
                label: {
                    defaultValue: 'Product Bundle Manager',
                    locales: [
                        {
                            value: 'Product Bundle Manager',
                            localeCode: 'en-US',
                        },
                        {
                            value: 'Gestor de Paquetes de Productos',
                            localeCode: 'es-ES',
                        },
                    ],
                },
            },
        },
    };

    const requestBody = {
        query: body.query,
        variables: body.variables,
    };

    return requestBody;
}

// Builds the GraphQL query required to retrieve all App Extensions installed on a store
export function getAppExtensions() {
    const body = {
        query: `
            query {
                store {
                    appExtensions {
                        edges {
                            node {
                                id
                                url
                                label {
                                    defaultValue
                                }
                                context
                                model
                            }
                        }
                    }
                }
            }`,
    };

    return body;
}

// Function to remove duplicate app extensions
export async function removeDuplicateAppExtensions({ accessToken, storeHash }: { accessToken: string, storeHash: string }) {
    try {
        const response = await fetch(
            `https://${process.env.API_URL}/stores/${storeHash}/graphql`,
            {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                    "x-auth-token": accessToken,
                },
                body: JSON.stringify(getAppExtensions()),
            }
        );

        const { data } = await response.json();
        const appExtensions = data?.store?.appExtensions?.edges || [];

        // Find our app extensions (those with our URL pattern)
        const ourExtensions = appExtensions.filter((edge: any) => 
            edge?.node?.url?.includes('/productAppExtension/')
        );

        // If we have more than one, remove the duplicates (keep the first one)
        if (ourExtensions.length > 1) {
            console.log(`Found ${ourExtensions.length} duplicate app extensions, removing ${ourExtensions.length - 1} duplicates`);
            
            // Remove all but the first one
            for (let i = 1; i < ourExtensions.length; i++) {
                const extensionId = ourExtensions[i].node.id;
                await removeAppExtension({ accessToken, storeHash, extensionId });
            }
        }

        return ourExtensions.length;
    } catch (error) {
        console.error('Error removing duplicate app extensions:', error);
        
return 0;
    }
}

// Function to remove a specific app extension
async function removeAppExtension({ accessToken, storeHash, extensionId }: { accessToken: string, storeHash: string, extensionId: string }) {
    const mutation = {
        query: `
            mutation DeleteAppExtension($input: DeleteAppExtensionInput!) {
                appExtension {
                    deleteAppExtension(input: $input) {
                        deletedAppExtensionId
                    }
                }
            }`,
        variables: {
            input: {
                id: extensionId
            }
        }
    };

    const response = await fetch(
        `https://${process.env.API_URL}/stores/${storeHash}/graphql`,
        {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "x-auth-token": accessToken,
            },
            body: JSON.stringify(mutation),
        }
    );

    const { errors } = await response.json();
    
    if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message);
    }
}
