// Quote every cell; neutralize spreadsheet formulas even after ignored whitespace.
export function csvCell(value){
  let text=String(value);
  if(typeof value==='string'&&/^[\s\u0000-\u001f]*[=+@-]/u.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
