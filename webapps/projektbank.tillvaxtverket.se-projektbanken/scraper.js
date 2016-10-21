/*

 http://projektbank.tillvaxtverket.se/projektbanken#page=eruf

 json data via POST in Browser to http://projektbank.tillvaxtverket.se/projektbanken/req/page-render

 */

var fs = require('fs');
var json = JSON.parse(fs.readFileSync('./manual.json'));

var cols = json.columns;
var result = json.rows.map(function (row, i) {
	var o = {_source: 'http://projektbank.tillvaxtverket.se/projektbanken#page=eruf'};
	row.forEach(function (cell, j) {
		if (cell.v)
			o[cols[j].name] = cell.o;
		else
			o[cols[j].name] = cell;
	});
	o._source = 'http://projektbank.tillvaxtverket.se/projektbanken';
	return o;
}).filter(function (o) {
	return o["Ärende-ID"] !== 'Totaler';
});

fs.writeFileSync('data.json', JSON.stringify(result, null, '\t'));
console.log('done');