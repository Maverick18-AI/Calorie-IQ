export const primary = ['cal','pro','carb','fat'];
export const extra = ['sat','fiber','sugar','sodium','cholesterol','potassium'];
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
  potassium:{name:'Potassium',unit:'mg',off:'potassium',factor:1000}
};
