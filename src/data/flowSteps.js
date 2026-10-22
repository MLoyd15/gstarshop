export const flowSteps = [
  {
    id: 'setup', number: 1, track: 'inventory', title: 'Set up your suppliers and materials',
    summary: 'Start with the things you buy and the people you buy them from.',
    whatHappens: [
      'Add suppliers, then add each material with its base unit and reorder level.',
      'Add roll width and its unit when a material comes on a roll.',
      'Record supplier prices for materials. Received purchases can also add price history.'
    ],
    commonMistakes: ['Using a different unit for a material in different places.', 'Forgetting a roll width unit when entering a roll width.'],
    goTo: 'suppliers', goToLabel: 'Suppliers, materials, and prices',
    previews: [{
      key: 'materialsList', caption: 'A quick look at material details and stock.',
      callouts: [
        { n: 1, label: 'Each material has a base unit.' },
        { n: 2, label: 'Add the roll width and width unit when it comes on a roll.' },
        { n: 3, label: 'Stock quantity is shown against the reorder level.' }
      ]
    }]
  },
  {
    id: 'products', number: 2, track: 'inventory', title: 'Build products with recipes',
    summary: 'A recipe says which materials and quantities are needed for one product.',
    whatHappens: [
      'Choose active materials and enter the quantity needed per product.',
      'The system calculates material unit cost and product cost from current material costs, then compares cost with sell price.'
    ],
    commonMistakes: ['Leaving out a material used to make the product.', 'Entering a recipe quantity in a unit that does not match the material base unit.'],
    goTo: 'products', goToLabel: 'Products',
    previews: [{
      key: 'productRecipe', caption: 'Recipe quantities contribute to the unit cost shown in the form.',
      callouts: [
        { n: 1, label: 'Add each material and its quantity per sales unit.' },
        { n: 2, label: 'Compare the live unit cost with the sell price and margin.' },
        { n: 3, label: 'Save the product recipe.' }
      ]
    }]
  },
  {
    id: 'purchases', number: 3, track: 'inventory', title: 'Order, receive, then pay',
    summary: 'A purchase order records what you plan to buy. Receiving is what adds stock.',
    whatHappens: [
      'Create a draft purchase order, then mark it ordered.',
      'Receive all or part of the order. Each receipt adds stock and records the supplier price.',
      'After all items are received, record one or more payments. A fully paid order is marked paid.',
      'Order statuses include draft, ordered, partially received, received, paid, and cancelled.',
      "A receipt can be reversed with a reason, unless the order is fully paid. A fully paid order's receipt cannot be reversed."
    ],
    commonMistakes: ['Expecting stock to increase when the order is created. Stock changes on receipt.', 'Trying to pay before all items are received.'],
    goTo: 'purchases', goToLabel: 'Purchases',
    previews: [{
      key: 'purchaseReceive', caption: 'Receive the quantities that arrived to post them into stock.',
      callouts: [
        { n: 1, label: 'Check each item and enter the quantity received.' },
        { n: 2, label: 'Submit the receipt to add stock and record supplier prices.' }
      ]
    }]
  },
  {
    id: 'plan-job', number: 4, track: 'inventory', title: 'Book a job and plan its materials',
    summary: 'Add a booking, then plan the materials the job will need.',
    whatHappens: [
      'Create a booking and add its material plan.',
      'Add a product recipe and quantity to fill the plan, then adjust the lines if needed.'
    ],
    commonMistakes: ['Trying to complete a job before adding a material plan.', 'Planning with an inactive or unavailable material.'],
    goTo: 'bookings', goToLabel: 'Bookings',
    previews: [{
      key: 'planMaterials', caption: 'Use a product recipe as a starting point, then save the booking plan.',
      callouts: [
        { n: 1, label: 'Choose a product recipe and the number of products.' },
        { n: 2, label: 'Add the scaled recipe quantities to the plan.' },
        { n: 3, label: 'Save planned materials; this does not change stock.' }
      ]
    }]
  },
  {
    id: 'complete-job', number: 5, track: 'inventory', title: 'Complete the job',
    summary: 'Record actual use and waste for every planned material.',
    whatHappens: [
      'Enter used and waste quantities for each planned line. Either quantity may be zero.',
      'Used material and waste are recorded as separate stock movements and both reduce stock.',
      'Material cost is calculated from used plus waste, using the material average cost at completion. The booking status becomes Completed.'
    ],
    commonMistakes: ['Entering planned quantities instead of actual quantities.', 'Leaving out a planned line when entering actual use and waste.'],
    goTo: 'bookings', goToLabel: 'Bookings',
    previews: [{
      key: 'completeJob', caption: 'Planned quantities are shown for reference; enter actual use and waste separately.',
      callouts: [
        { n: 1, label: 'Enter the quantity actually used.' },
        { n: 2, label: 'Enter any waste separately.' },
        { n: 3, label: 'Click Complete job to record the stock movements.' }
      ]
    }]
  },
  {
    id: 'correct-job', number: 6, track: 'inventory', title: 'Correct a completed job',
    summary: 'Reverse a completion before changing or deleting its booking.',
    whatHappens: [
      'The reversal needs a reason and confirmation that all recorded material is physically returned and reusable.',
      'The system adds reversal movements to restore the recorded stock and returns the booking to its prior status.',
      'After reversal, the booking can be edited or deleted and completed again if needed.'
    ],
    commonMistakes: ['Reversing a job when the material was not actually returned and reusable.', 'Trying to edit a completed booking before reversing it.'],
    goTo: 'bookings', goToLabel: 'Bookings',
    previews: [{
      key: 'reverseCompletion', caption: 'The reversal needs a confirmation and a correction reason.',
      callouts: [
        { n: 1, label: 'Confirm the recorded materials are physically returned and reusable.' },
        { n: 2, label: 'Enter a reason for the correction.' },
        { n: 3, label: 'Reverse completion to restore the recorded stock.' }
      ]
    }]
  },
  {
    id: 'monitor', number: 7, track: 'inventory', title: 'Monitor stock and reports',
    summary: 'Use material balances and reports to decide what needs attention.',
    whatHappens: [
      'Low stock means an active material has a quantity at or below its reorder level. Out of stock means its quantity is zero.',
      'Reorder suggestions group low-stock materials by supplier and suggest quantities based on the reorder level.',
      'The Materials page shows stock movements, waste history, and inventory valuation. The Reports page summarizes G4 Sticker activity.'
    ],
    commonMistakes: ['Assuming an inactive material appears in the low-stock list. The low-stock count only includes active materials.', 'Treating a reorder suggestion as a purchase order; you still need to create and order one.'],
    goTo: 'materials', goToLabel: 'Materials and reports',
    previews: [{
      key: 'inventoryLowStock', caption: 'Low-stock and out-of-stock labels follow the material’s quantity and reorder level.',
      callouts: [
        { n: 1, label: 'Low stock means an active material is at or below its reorder level.' },
        { n: 2, label: 'Out of stock means an active material has zero quantity.' }
      ]
    }]
  },
  {
    id: 'employees', number: 8, track: 'payroll', title: 'Set up employees and pay rates',
    summary: 'Keep employee details and pay basis current before a pay run.',
    whatHappens: [
      'Add employees with a pay rate and pay basis, such as hourly or monthly.',
      'Only active employees are included when generating a pay run. Hourly employees need saved hours; the current timesheet does not support daily pay.'
    ],
    commonMistakes: ['Generating an hourly pay run before saving hours for the period.', 'Expecting daily-rate employees to be included in the current generated pay run.'],
    goTo: 'employees', goToLabel: 'Employees'
  },
  {
    id: 'pay-run', number: 9, track: 'payroll', title: 'Generate, finalize, and pay',
    summary: 'Generate draft runs, check them, then finalize before recording payments.',
    whatHappens: [
      'Generate a run for a period. The system skips employees with an existing run for that period and reports other employees it skips.',
      'Edit or delete a run while it is a draft, then finalize it.',
      'Record full or partial payments after finalizing. The run becomes partially-paid or paid.',
      'Run statuses include draft, finalized, partially-paid, paid, and reversed. A run can be reversed only while finalized and with no payments recorded. A reversal needs a reason.'
    ],
    commonMistakes: ['Trying to edit a finalized run.', 'Trying to reverse a run after recording a payment.'],
    goTo: 'payroll-runs', goToLabel: 'Pay runs',
    previews: [{
      key: 'payRun', caption: 'A draft can be finalized, then paid in full or in parts.',
      callouts: [
        { n: 1, label: 'Generate a draft pay run for the selected period.' },
        { n: 2, label: 'Finalize the draft after reviewing it.' },
        { n: 3, label: 'Record a payment after the run is finalized.' }
      ]
    }]
  }
];

export const glossary = [
  {
    question: 'Why can’t I edit stock directly?',
    answer: 'Stock quantity and average cost change through recorded stock movements. This keeps a history of why a balance changed.'
  },
  {
    question: 'What do the movement types mean?',
    answer: 'Opening adds the starting balance before any other movement. Purchase in adds received stock. Job use removes material used on a job. Waste removes material recorded as waste. Adjustment updates stock to match a physical count. Return in adds returned material. Reversal corrects an earlier movement.'
  },
  {
    question: 'What is the difference between used and waste?',
    answer: 'Used is material that went into the job. Waste is material lost or unusable during the job. Both reduce stock and count toward the job’s material cost.'
  },
  {
    question: 'Why can’t I edit a completed booking?',
    answer: 'A completed booking has already created stock movements. Reverse its completion with a reason first. Confirm that the recorded material is physically returned and reusable.'
  },
  {
    question: 'What do low stock and out of stock mean?',
    answer: 'Low stock means an active material’s quantity is at or below its reorder level. Out of stock means the quantity is zero. A reorder level of zero means zero stock also meets the low-stock rule.'
  }
];
