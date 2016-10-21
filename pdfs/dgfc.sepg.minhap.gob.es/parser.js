var PDFParser = require("pdf2json/pdfparser");
var fs = require('fs');
var async = require('async');
var path = require("path");

var debug = false;
var debugcache = '../../local/cache/';
if (!fs.existsSync('../../local/cache/')) {
	console.log('warning cache folder doesn\'t exists');
}

var parsePDF = function (filename, cb) {
	var pdfParser = new PDFParser();

	pdfParser.on("pdfParser_dataReady", function (data) {
		try {
			fs.writeFileSync(debugcache + filename + '.json', JSON.stringify(data, null, '\t'));
			cb(null, data);
		} catch (err) {
			console.log(err.stack);
		}
	});

	pdfParser.on("pdfParser_dataError", function (err) {
		try {
			cb(err, null);
		} catch (err) {
			console.log(err.stack);
		}
	});

	fs.exists(debugcache + filename + '.json', function (exists) {
		if (exists) {
			fs.readFile(debugcache + filename + '.json', function (err, buffer) {
				if (err) return cb(err);
				cb(null, JSON.parse(buffer.toString()));
			});
		} else {
			console.log('parsing', filename);
			fs.readFile(filename, function (err, buffer) {
				if (err) return cb(err);
				pdfParser.parseBuffer(buffer);
			});
		}
	});
};


var _VALUE = 0;
var _INT = 1;
var _TEXT = 2;
var _YEAR = 3;

var stuff = [
	["Total operaciones de ayuda:", _VALUE, _VALUE],
	["Total beneficiario:", _VALUE, _VALUE],
	["Total operaciones de inversión:", _VALUE, _VALUE],
	["TOTAL PROGRAMA:", _VALUE, _VALUE],
	["Relación de operaciones por beneficiario", "Pág.", _INT, " de ", _INT],
	["Relación de operaciones por beneficiario"],
	["Pág.", _INT, " de ", _INT],
	["Pág.", _INT, " de ", "  ***  "],
	["Pág.", "  ***  ", " de ", "  ***  "],
	["Nombre beneficiario", "Nombre operación", "pagado final", "concesión/año"],
	["Nombre beneficiario"],
	["Nombre operación"],
	["pagado final"],
	["concesión/año"],
	["Montante "],
	["concedido"],
	["operación", "del pago"],
	["del pago"],
	["operación"],
	["Montante", "Año de la"],
	["Montante"],
	["Año de la"],
	["Operaciones de ayuda", "(Euros)"],
	["Operaciones de ayuda"],
	["(Euros)"],
	["Programa operativo :"],
	["Programa operativo :", _TEXT, _TEXT],
];

var valid = [
	[_TEXT, _TEXT, _VALUE, _VALUE, _YEAR],
	[null, _TEXT, _VALUE, _VALUE, _YEAR],
	[null, _TEXT],
	[_TEXT, _TEXT],
	[null, _YEAR],
	[_TEXT, _YEAR],
	[_TEXT]
];

var isValue = function (cell) {
	return cell !== null && (cell.indexOf(',') >= 0) && !isNaN(cell.trim().replace(/\./g, '').replace(/\,/g, '.'));
};

var isInt = function (cell) {
	return cell !== null && !isNaN(parseInt(cell, 10));
};

var isYear = function (cell) {
	if (cell !== null && (cell.indexOf(' ') < 0) && (cell.trim().length == 4)) {
		var i = parseInt(cell.trim(), 10);
		if (isNaN(i)) return false;
		return i > 1990 && i < 2017;
	}
	return false;
};

var isText = function (cell) {
	return cell !== null &&
		(!isValue(cell)) && (!isYear(cell));
};

var isType = function (cell, type) {
	if (type === null) {
		if (cell !== null) {
			return false;
		}
	} else if (type === _INT) {
		if (!isInt(cell)) {
			return false;
		}
	} else if (type === _VALUE) {
		if (!isValue(cell)) {
			return false;
		}
	} else if (type === _YEAR) {
		if (!isYear(cell)) {
			return false;
		}
	} else if (type === _TEXT) {
		if (!isText(cell)) {
			return false;
		}
	} else if (typeof type === 'string') {
		if (type !== cell) {
			return false;
		}
	}
	return true;
};

var validateRow = function (format, row) {
	if (row.length !== format.length) return false;
	for (var j = 0; j < row.length; j++) {
		if (!isType(row[j], format[j])) {
			return false;
		}
	}
	return row.length > 0;
};

var validateItems = function (format, items) {
	if (items.length !== format.length) return false;
	for (var j = 0; j < items.length; j++) {
		var cell = items[j][0].t;
		if (!isType(cell, format[j])) {
			return false;
		}
	}
	return items.length > 0;
};

var isValidItems = function (item) {
	for (var i = 0; i < stuff.length; i++) {
		var format = stuff[i];
		if (validateItems(format, item.items)) {
			return true;
		}
	}
	return false;
};

var isValidRow = function (row) {
	for (var i = 0; i < valid.length; i++) {
		var format = valid[i];
		if (validateRow(format, row)) {
			return true;
		}
	}
	return false;
};

var parsePage = function (page, filename, cb) {
	if (page.nr == 0) return cb(null, []);

	var y = {};

	page.Texts.forEach(function (text, i) {
		y[text.y] = y[text.y] || [];
		y[text.y].push(text);
	});

	var list = Object.keys(y).map(function (key) {
		return {
			y: key,
			p: page.nr,
			items: y[key].map(function (t) {
				return t.R.map(function (r) {
					return {x: t.x, t: decodeURIComponent(r.T)};
				});
			})
		};
	});
	list.sort(function (a, b) {
		return a.y - b.y;
	});
	for (var i = list.length - 1; i > 0; i--) {
		var r1 = list[i - 1];
		var r2 = list[i];
		var diff = r2.y - r1.y;
		if (diff < 0.12) {
			r1.items = r1.items.concat(r2.items);
			r2.items = [];
			// console.log(i, r2.y - r1.y, r1.y, r2.y, page.nr);
		}
	}


	list.forEach(function (item) {
		item.items = item.items.sort(function (a, b) {
			return a[0].x - b[0].x;
		});
	});
	list = list.filter(function (item) {
		return (item.items.length > 0) && !isValidItems(item);
	});


	if (debug)
		fs.writeFileSync(debugcache + filename + '-' + page.nr + '.json', JSON.stringify(list, null, '\t'));

	process.nextTick(function () {
		cb(null, list);
	});

};

var convertToRows = function (list) {
	return list.map(function (item) {
		if (item.items.length > 5) {
			console.log('alarm, item.length ==', item.items.length);
		}
		var row = [];
		item.items.forEach(function (cell) {
			if (cell.length > 1)
				console.log('alarm, cell.length ==', cell.length);
			var x = cell[0].x;
			var col = 0;
			if (x < 15) {
				col = 0;
			} else if (x < 20) {
				col = 1;
			} else if (x < 44) {
				col = 2;
			} else if (x < 50) {
				col = 3;
			} else {
				col = 4;
			}
			if (row[col]) {
				console.log('alarm, double content for cell', cell, 'page:', page.nr);
			}
			while (row.length <= col) row.push(null);
			row[col] = cell[0].t
		});
		return row;
	});

};

var parse = function (filename, cb) {
	var collect = [];
	var raw_collect = [];
	parsePDF(filename, function (err, data) {
		if (err) return console.log(err);
		data.formImage.Pages.forEach(function (page, i) {
			page.nr = i;
		});
		async.forEachSeries(data.formImage.Pages, function (page, next) {
			parsePage(page, filename, function (err, list) {
				if (err)  return console.log(err);
				if (debug)
					raw_collect = raw_collect.concat(list);

				var rows = [];
				var rows_raw = convertToRows(list);
				rows_raw.forEach(function (row) {
					if (!isValidRow(row)) {
						if (validateRow([null, "ACCIONES FORMATIVAS FOMENTO DE LA INTEGRACION SOCIAL ", " 100.000,00", " 66.171,75"], row)) {
							rows.push(["AYUNTAMIENTO DE JAEN", "E IGUALDAD DE OPORTUNIDADES. CURSOS", "ACCIONES FORMATIVAS FOMENTO DE LA INTEGRACION SOCIAL ", " 100.000,00", " 66.171,75", "2015"]);
						} else if (validateRow(["AYUNTAMIENTO DE JAEN", "E IGUALDAD DE OPORTUNIDADES. CURSOS", null, null, "2015"], row)) {
							//ignore, handled above
						} else if (validateRow([null, "1,2"], row)) {
							rows.push(row);
						} else if (validateRow([null, "07,E.58"], row)) {
							rows.push(row);
						} else
							console.log('ALARM, INVALID Row', JSON.stringify(row));

					} else {
						rows.push(row);
					}
				});
				collect = collect.concat(rows);
				next();
			});
		}, function (err) {
			if (err) return console.log(err);
			if (debug) {
				fs.writeFileSync(debugcache + '_' + filename + '.json', JSON.stringify(raw_collect, null, '\t'));
				var sl = collect.map(function (row) {
					return JSON.stringify(row);
				});
				fs.writeFileSync(debugcache + '_' + filename + ".rows.json", '[' + sl.join(',\n') + ']');
			}
			var final = [];
			var item = null;
			var cleanString = function (cell) {
				return (cell || '').trim();
			};
			collect.forEach(function (row) {
				if (row.length == 5) {
					item = {
						col1: row[0] || '',
						col2: row[1] || '',
						val1: cleanString(row[2]),
						val2: cleanString(row[3]),
						year: cleanString(row[4])
					};
					final.push(item);
				} else {
					if (row[0])
						item.col1 = item.col1 + (item.col1.length > 0 ? '\n' : '') + (row[0] || '');
					if (row[1])
						item.col2 = item.col2 + '\n' + (row[1] || '');
				}
			});
			var last = null;
			final.forEach(function (item) {
				if (!last) last = item;
				if (item.col1.length === 0) {
					item.col1 = last.col1;
				}
			});
			cb(err, final);
		})
	});
};

exports.parse = parse;

