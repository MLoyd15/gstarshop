export const previewBadgeNumbers = {
  materialsList: [1, 2, 3],
  productRecipe: [1, 2, 3],
  purchaseReceive: [1, 2],
  planMaterials: [1, 2, 3],
  completeJob: [1, 2, 3],
  reverseCompletion: [1, 2, 3],
  inventoryLowStock: [1, 2],
  payRun: [1, 2, 3]
};

export const previewLoaders = {
  materialsList: () => import('./previews/MaterialsListPreview.jsx'),
  productRecipe: () => import('./previews/ProductRecipePreview.jsx'),
  purchaseReceive: () => import('./previews/PurchaseReceivePreview.jsx'),
  planMaterials: () => import('./previews/PlanMaterialsPreview.jsx'),
  completeJob: () => import('./previews/CompleteJobPreview.jsx'),
  reverseCompletion: () => import('./previews/ReverseCompletionPreview.jsx'),
  inventoryLowStock: () => import('./previews/InventoryLowStockPreview.jsx'),
  payRun: () => import('./previews/PayRunPreview.jsx')
};
