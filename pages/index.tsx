/* eslint-disable no-console */
import { Box, Button, H1, Panel, Text } from '@bigcommerce/big-design';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  const goTo = (path: string) => router.push({ pathname: path, query: router.query });

  return (
    <Box padding="large">
      <Panel>
        <H1>Welcome</H1>
        <Text marginTop="medium">
          Manage your products, bundles, and discounts using the navigation above.
        </Text>
          <Box marginTop="large" display="flex" style={{ gap: 12 }}>
            <Button onClick={() => goTo('/products')}>Go to Products</Button>
            <Button onClick={() => goTo('/bundles/stock')}>Go to Bundles</Button>
            <Button onClick={() => goTo('/discounts')}>Go to Discounts</Button>
          </Box>
      </Panel>
    </Box>
  );
}
