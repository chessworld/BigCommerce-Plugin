import { TableItem } from '@types';

// useProducts Mock
const summaryMock = {
    inventory_count: 3,
    variant_count: 2,
    primary_category_name: 'widgets',
};

export const useProducts = jest.fn().mockImplementation(() => ({
    summary: summaryMock,
}));

// useProductList Mock
export const ROW_NUMBERS = 5;

// Generate mock tableItems
const generateList = (): TableItem[] => (
    [...Array(ROW_NUMBERS)].map((_, index) => ({
        id: index,
        name: `Product ${index}`,
        price: (index + 1) * 10,
        stock: 7,
    }))
);

export const useProductList = jest.fn().mockImplementation(() => ({
    list: generateList(),
    meta: { pagination: { total: ROW_NUMBERS } }
}));

// useProductInfo Mock
const productMock = {
    description: '<h1>some sample product</h1>',
    isVisible: true,
    name: 'Product 1',
    price: 20,
    type: 'physical',
};

export const useProductInfo = jest.fn().mockImplementation(() => ({
    product: productMock,
}));

// useAllProducts Mock
const allProductsMock = [...Array(3)].map((_, index) => ({
    id: index + 100,
    name: `All Product ${index}`,
    sku: `ALL-SKU-${index}`,
    price: (index + 1) * 15,
    inventory_level: 10,
    inventory_tracking: 'product',
    variants: [],
}));

export const useAllProducts = jest.fn().mockImplementation(() => ({
    list: allProductsMock,
    meta: { pagination: { total: allProductsMock.length } },
    isLoading: false,
    error: null,
    mutate: jest.fn(),
}));

// useBundles Mock
const bundlesMock = [
    {
        id: 1,
        name: 'Sample Bundle 1',
        linkedProductIds: [1, 2, 3],
        quantities: [1, 2, 1],
    },
    {
        id: 2,
        name: 'Sample Bundle 2',
        linkedProductIds: [4, 5],
        quantities: [1, 1],
    },
];

export const useBundles = jest.fn().mockImplementation(() => ({
    bundles: bundlesMock,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
}));
