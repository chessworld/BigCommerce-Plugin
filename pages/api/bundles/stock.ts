import type { NextApiRequest, NextApiResponse } from 'next';
import { bigcommerceClient, getSession } from '@lib/auth';
import { parseLinkedProduct } from '@lib/bundle-calculator';

interface BundleComponent {
  productId: number;
  variantId?: number;
  name: string;
  sku: string;
  quantity: number;
  stock: number;
  maxBundles: number;
}

interface BundleStockInfo {
  id: number;
  name: string;
  sku: string;
  stock: number;
  components: BundleComponent[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getSession(req);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { accessToken, storeHash } = session;
    const bc = bigcommerceClient(accessToken, storeHash);

    // First, get the Bundle category ID to filter products
    const { data: categories } = await bc.get('/catalog/categories?limit=250');
    const bundleCategory = categories.find((c: any) => 
      String(c?.name || '').toLowerCase() === 'bundle'
    );

    // If no bundle category exists, return empty array
    if (!bundleCategory) {
      return res.status(200).json({ bundles: [] });
    }

    // Fetch only products in the Bundle category (much more efficient!)
    let allProducts = [];
    let currentPage = 1;
    let hasMorePages = true;

    // Fetch all pages of bundle products only
    while (hasMorePages) {
      const params = new URLSearchParams({ 
        page: String(currentPage),
        limit: '250', // Maximum allowed
        include: 'variants',
        'categories:in': String(bundleCategory.id)
      }).toString();

      const response = await bc.get(`/catalog/products?${params}`);
      
      allProducts = allProducts.concat(response.data);
      
      // Check if there are more pages
      const totalPages = response.meta?.pagination?.total_pages || 1;
      hasMorePages = currentPage < totalPages;
      currentPage++;
    }

    const products = allProducts;

    const bundles: BundleStockInfo[] = [];

    // Process each product to find bundles
    for (const product of products) {
      // Check product-level metafields for bundles
      const { data: productMetafields } = await bc.get(`/catalog/products/${product.id}/metafields`);
      const isProductBundle = productMetafields.find(
        (f: any) => f.key === 'is_bundle' && f.namespace === 'bundle'
      )?.value === 'true';

      if (isProductBundle) {
        const linkedField = productMetafields.find(
          (f: any) => f.key === 'linked_product_ids' && f.namespace === 'bundle'
        );
        
        if (linkedField) {
          const linkedProductIds = JSON.parse(linkedField.value);
          const components: BundleComponent[] = [];

          // Fetch details for each component
          for (const linkedProduct of linkedProductIds) {
            const { productId, variantId, quantity } = parseLinkedProduct(linkedProduct);
            
            try {
              if (variantId) {
                // Fetch variant details
                const { data: variant } = await bc.get(
                  `/catalog/products/${productId}/variants/${variantId}`
                );
                const { data: parentProduct } = await bc.get(`/catalog/products/${productId}`);
                
                const variantName = variant.option_values
                  ?.map((ov: any) => ov.label)
                  .join(' - ') || 'Variant';
                
                components.push({
                  productId,
                  variantId,
                  name: `${parentProduct.name} - ${variantName}`,
                  sku: variant.sku,
                  quantity,
                  stock: variant.inventory_level || 0,
                  maxBundles: Math.floor((variant.inventory_level || 0) / quantity),
                });
              } else {
                // Fetch product details
                const { data: componentProduct } = await bc.get(`/catalog/products/${productId}`);
                
                components.push({
                  productId,
                  name: componentProduct.name,
                  sku: componentProduct.sku,
                  quantity,
                  stock: componentProduct.inventory_level || 0,
                  maxBundles: Math.floor((componentProduct.inventory_level || 0) / quantity),
                });
              }
            } catch (error) {
              console.error(`Error fetching component ${productId}:${variantId || 'N/A'}:`, error);
              // Add component with error state
              components.push({
                productId,
                variantId,
                name: 'Unknown Component',
                sku: 'N/A',
                quantity,
                stock: 0,
                maxBundles: 0,
              });
            }
          }

          bundles.push({
            id: product.id,
            name: product.name,
            sku: product.sku,
            stock: product.inventory_level || 0,
            components,
          });
        }
      }

      // Check variant-level bundles
      if (product.variants?.length > 0) {
        for (const variant of product.variants) {
          const { data: variantMetafields } = await bc.get(
            `/catalog/products/${product.id}/variants/${variant.id}/metafields`
          );
          const isVariantBundle = variantMetafields.find(
            (f: any) => f.key === 'is_bundle' && f.namespace === 'bundle'
          )?.value === 'true';

          if (isVariantBundle) {
            const linkedField = variantMetafields.find(
              (f: any) => f.key === 'linked_product_ids' && f.namespace === 'bundle'
            );
            
            if (linkedField) {
              const linkedProductIds = JSON.parse(linkedField.value);
              const components: BundleComponent[] = [];

              // Fetch details for each component
              for (const linkedProduct of linkedProductIds) {
                const { productId, variantId: compVariantId, quantity } = parseLinkedProduct(linkedProduct);
                
                try {
                  if (compVariantId) {
                    const { data: compVariant } = await bc.get(
                      `/catalog/products/${productId}/variants/${compVariantId}`
                    );
                    const { data: parentProduct } = await bc.get(`/catalog/products/${productId}`);
                    
                    const variantName = compVariant.option_values
                      ?.map((ov: any) => ov.label)
                      .join(' - ') || 'Variant';
                    
                    components.push({
                      productId,
                      variantId: compVariantId,
                      name: `${parentProduct.name} - ${variantName}`,
                      sku: compVariant.sku,
                      quantity,
                      stock: compVariant.inventory_level || 0,
                      maxBundles: Math.floor((compVariant.inventory_level || 0) / quantity),
                    });
                  } else {
                    const { data: componentProduct } = await bc.get(`/catalog/products/${productId}`);
                    
                    components.push({
                      productId,
                      name: componentProduct.name,
                      sku: componentProduct.sku,
                      quantity,
                      stock: componentProduct.inventory_level || 0,
                      maxBundles: Math.floor((componentProduct.inventory_level || 0) / quantity),
                    });
                  }
                } catch (error) {
                  console.error(`Error fetching component ${productId}:${compVariantId || 'N/A'}:`, error);
                  components.push({
                    productId,
                    variantId: compVariantId,
                    name: 'Unknown Component',
                    sku: 'N/A',
                    quantity,
                    stock: 0,
                    maxBundles: 0,
                  });
                }
              }

              const variantName = variant.option_values
                ?.map((ov: any) => ov.label)
                .join(' - ') || 'Variant';

              bundles.push({
                id: variant.id,
                name: `${product.name} - ${variantName}`,
                sku: variant.sku,
                stock: variant.inventory_level || 0,
                components,
              });
            }
          }
        }
      }
    }

    res.status(200).json({ bundles });
  } catch (error) {
    console.error('Error fetching bundle stock:', error);
    res.status(500).json({ message: 'Error fetching bundle stock' });
  }
}

