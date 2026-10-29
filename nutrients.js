export const primary = ['cal','pro','carb','fat'];
export const extra = ['sat','fiber','sugar','sodium','cholesterol','potassium','calcium','iron','magnesium','vitC','vitD','b12','folate'];
export const additional = ['calcium','iron','magnesium','vitC','vitD','b12','folate'];
export const nutrients = [...primary,...extra];
export const nutrientInfo = {
  cal:{name:'Calories',unit:'kcal',off:'energy-kcal',factor:1},
  pro:{name:'Protein',unit:'g',off:'proteins',factor:1},
  carb:{name:'Carbohydrates',unit:'g',off:'carbohydrates',factor:1},
  fat:{name:'Total fat',unit:'g',off:'fat',factor:1},
  sat:{name:'Saturated fat',unit:'g',off:'saturated-fat',factor:1},
  fiber:{name:'Fiber',unit:'g',off:'fiber',factor:1},
  sugar:{name:'Total sugars',unit:'g',off:'sugars',factor:1},
  sodium:{name:'Sodium',unit:'mg',off:'sodium',factor:1000},
  cholesterol:{name:'Cholesterol',unit:'mg',off:'cholesterol',factor:1000},
  potassium:{name:'Potassium',unit:'mg',off:'potassium',factor:1000},
  calcium:{name:'Calcium',unit:'mg',off:'calcium',factor:1000},
  iron:{name:'Iron',unit:'mg',off:'iron',factor:1000},
  magnesium:{name:'Magnesium',unit:'mg',off:'magnesium',factor:1000},
  vitC:{name:'Vitamin C',unit:'mg',off:'vitamin-c',factor:1000},
  vitD:{name:'Vitamin D',unit:'µg',off:'vitamin-d',factor:1000000},
  b12:{name:'Vitamin B12',unit:'µg',off:'vitamin-b12',factor:1000000},
  folate:{name:'Folate, total',unit:'µg',off:'folates',factor:1000000}
};
