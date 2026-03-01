import fs from 'fs';

const data = JSON.parse(fs.readFileSync('rest.json', 'utf-8'));
console.log('Recurring Expenses Schema Keys:');
console.log(Object.keys(data.definitions.recurring_expenses.properties));
