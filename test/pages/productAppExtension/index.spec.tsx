import { useRouter } from "next/router";
import ProductAppExtension from "@pages/productAppExtension/[productId]"; 
import { render, screen, waitFor } from '@test/utils';

jest.mock('@lib/hooks', () => require('@mocks/hooks'));
jest.mock('next/router', () => ({
    useRouter: jest.fn(),
}));

describe('ProductAppExtension', () => {
    const router = { query: { productId: '1' } };
    (useRouter as jest.Mock).mockReturnValue(router);

    test('renders correctly', async () => {
        const { container } = render(<ProductAppExtension />);

        // The bundle settings panel header is the product name (from the mocked
        // useProductInfo); it appears once the loading flags settle. The page fires
        // several async state updates on mount, so re-query until the DOM is stable.
        await waitFor(() => {
            expect(screen.getByText('Product 1')).toBeInTheDocument();
        });

        expect(container.firstChild).toMatchSnapshot();
    });
});

