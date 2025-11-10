import { Box, Button, Flex, H1, Input, Panel, Table, Text } from '@bigcommerce/big-design';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import ErrorMessage from '../../components/error';
import Loading from '../../components/loading';
import { useSession } from '../../context/session';

interface BundleComponent {
  productId: number;
  variantId?: number;
  name: string;
  sku: string;
  quantity: number;
  stock: number;
  maxBundles: number;
}

interface Bundle {
  id: number;
  name: string;
  sku: string;
  stock: number;
  components: BundleComponent[];
  isExpanded?: boolean;
}

const BundleStockPage = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { context } = useSession();

  useEffect(() => {
    if (!context) return;

    const fetchBundleStock = async () => {
      try {
        const res = await fetch(`/api/bundles/stock?context=${encodeURIComponent(context)}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.message || 'Failed to fetch bundle stock');
        }
        
        setBundles(data.bundles || []);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBundleStock();
  }, [context]);

  const toggleExpand = (bundleId: number) => {
    setBundles(prev => 
      prev.map(bundle => 
        bundle.id === bundleId 
          ? { ...bundle, isExpanded: !bundle.isExpanded } 
          : bundle
      )
    );
  };

  const renderBundleName = (bundle: Bundle) => (
    <Flex alignItems="center">
      <Button
        variant="subtle"
        onClick={() => toggleExpand(bundle.id)}
      >
        <Text bold>{bundle.isExpanded ? '▼' : '▶'}</Text>
      </Button>
      <Box marginLeft="small">
        <Text bold>{bundle.name}</Text>
      </Box>
    </Flex>
  );

  const renderStock = (stock: number) => {
    return <Text>{stock}</Text>;
  };

  const getTableItems = () => {
    const items: any[] = [];
    
    // Filter bundles based on search query
    const filteredBundles = bundles.filter(bundle => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      
return (
        bundle.name.toLowerCase().includes(query) ||
        bundle.sku.toLowerCase().includes(query)
      );
    });
    
    filteredBundles.forEach(bundle => {
      // Calculate the minimum maxBundles to identify the limiting component
      const minMaxBundles = bundle.components.length > 0 
        ? Math.min(...bundle.components.map(c => c.maxBundles))
        : 0;

      // Add the main bundle row
      items.push({
        id: bundle.id,
        type: 'bundle',
        name: bundle.name,
        sku: bundle.sku,
        stock: bundle.stock,
        quantity: '-',
        maxBundles: '-',
        bundle: bundle,
      });
      
      // Add component rows if expanded
      if (bundle.isExpanded) {
        bundle.components.forEach((component, idx) => {
          const isLimiting = component.maxBundles === minMaxBundles;
          items.push({
            id: `${bundle.id}-component-${idx}`,
            type: 'component',
            name: component.name,
            sku: component.sku,
            stock: component.stock,
            quantity: component.quantity,
            maxBundles: component.maxBundles,
            isComponent: true,
            isLimiting: isLimiting,
          });
        });
      }
    });
    
    return items;
  };

  const getFilteredBundlesCount = () => {
    if (!searchQuery) return bundles.length;
    const query = searchQuery.toLowerCase();
    
return bundles.filter(bundle => 
      bundle.name.toLowerCase().includes(query) ||
      bundle.sku.toLowerCase().includes(query)
    ).length;
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <Panel>
      <Box marginBottom="large" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <H1>Bundle Stock Tracker</H1>
        <Button variant="secondary" onClick={() => router.reload()}>
          Refresh Stock
        </Button>
      </Box>
      
      <Box marginBottom="medium">
        <Text>Track inventory levels for bundles and their components. Expand any bundle to see component details.</Text>
        <Text color="secondary60" marginTop="xSmall">
          <Text as="span" bold>⚠️</Text> The warning symbol indicates the limiting component - the item with the lowest &quot;Max Bundles&quot; value that determines how many complete bundles you can make.
        </Text>
      </Box>

      <Box marginBottom="medium">
        <Input
          placeholder="Search bundles by name or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Text color="secondary60" marginTop="xSmall">
            Showing {getFilteredBundlesCount()} of {bundles.length} bundles
          </Text>
        )}
      </Box>

      {bundles.length > 0 ? (
        <Table
          columns={[
            {
              header: 'Product Name',
              hash: 'name',
              render: (item) => {
                if (item.type === 'bundle') {
                  return renderBundleName(item.bundle);
                }
                
return <Text marginLeft="xxLarge">{item.name}</Text>;
              },
            },
            {
              header: 'SKU',
              hash: 'sku',
              render: ({ sku }) => <Text>{sku}</Text>,
            },
            {
              header: 'Current Stock',
              hash: 'stock',
              render: ({ stock }) => renderStock(stock),
            },
            {
              header: 'Qty per Bundle',
              hash: 'quantity',
              render: ({ quantity, isComponent }) => 
                isComponent ? <Text>{quantity}</Text> : <Text color="secondary30">-</Text>,
            },
            {
              header: 'Max Bundles',
              hash: 'maxBundles',
              render: ({ maxBundles, isComponent, isLimiting }) => 
                isComponent ? (
                  <Text bold={isLimiting} color={isLimiting ? 'danger' : undefined}>
                    {maxBundles} {isLimiting && '⚠️'}
                  </Text>
                ) : <Text color="secondary30">-</Text>,
            },
          ]}
          items={getTableItems()}
          stickyHeader
        />
      ) : (
        <Box padding="large" backgroundColor="secondary10">
          <Text>No bundles found. Create bundles to track their stock levels.</Text>
          <Box marginTop="medium">
            <Button onClick={() => router.push('/products')}>Go to Products</Button>
          </Box>
        </Box>
      )}
    </Panel>
  );
};

export default BundleStockPage;

