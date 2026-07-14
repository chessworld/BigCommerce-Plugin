import Index from '@pages/index';
import { render, screen } from '@test/utils';

describe('Homepage', () => {
    test('renders correctly', () => {
        const { container } = render(<Index />);

        // Main heading
        const mainHeading = screen.getByRole('heading', { level: 1 });
        expect(mainHeading).toBeInTheDocument();
        expect(mainHeading).toHaveTextContent('Welcome');

        // Intro copy
        expect(
            screen.getByText('Manage your products, bundles, and discounts using the navigation above.')
        ).toBeInTheDocument();

        // Navigation buttons
        expect(screen.getByRole('button', { name: 'Go to Products' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go to Bundles' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go to Discounts' })).toBeInTheDocument();

        expect(container.firstChild).toMatchSnapshot();
    });
});
