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
var _TEXT = 1;
var _CHAR = 2;

var valid = [
	[_TEXT, _TEXT, _VALUE, _CHAR],
	[_TEXT, _TEXT],
	[null, _TEXT],
	[_TEXT]
];

var isValue = function (cell) {
	return cell !== null && (cell.indexOf(',') >= 0) && !isNaN(cell.trim().replace(/\./g, '').replace(/\,/g, '.'));
};

var isChar = function (cell) {
	return (cell !== null) && (['A', 'G'].indexOf(cell.trim()) >= 0);
};

var isText = function (cell) {
	return cell !== null &&
		(!isValue(cell)) && (!isChar(cell));
};

var isType = function (cell, type) {
	if (type === null) {
		if (cell !== null) {
			return false;
		}
	} else if (type === _VALUE) {
		if (!isValue(cell)) {
			return false;
		}
	} else if (type === _CHAR) {
		if (!isChar(cell)) {
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
	var tableRows = -1;
	list = list.filter(function (item) {
		if (item.items.length == 0) return false;
		if (tableRows == -1) {
			if (item.items[0][0].t === '(in Euro)') { //table start
				tableRows = 0;
			}
		} else if (tableRows > -1) {
			if (item.items[0][0].t.indexOf('Druckdatum:') >= 0) {
				tableRows = -1; //table end
			} else { //in table
				tableRows++;
			}
		}
		return tableRows > 0;
	});
	if (list.length == 0) {
		console.log('warning, page without data');
	}

	if (debug)
		fs.writeFileSync(debugcache + filename + '-' + page.nr + '.json', JSON.stringify(list, null, '\t'));

	process.nextTick(function () {
		cb(null, list);
	});

};

var convertToRows = function (list, page) {
	return list.map(function (item, i) {
		if (item.items.length > 4) {
			if (item.items[0][0].t === '+RO]FOXVWHU\u00036WHLHUPDUN\u0003*PE+\u001e\u0003$GROI\u00030DWWQHU\u001e\u0003\'LSO\u0011,QJ\u0011*DXOKRIHU\u0003*P') {
				item.items.shift();
				item.items[0][0].x = 0;
			} else if (item.items[0][0].t === 'Holzcluster Steiermark GmbH; Adolf Mattner; Dipl.Ing.Gaulhofer Gm') {
				item.items[1][0].t = item.items[0][0].t + item.items[1][0].t; // + 'bH&Co'
				item.items.shift();
				item.items[0][0].x = 0;
			} else {
				console.log('alarm, item.length ==', item.items.length);
			}
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
			} else if (x < 45) {
				col = 2;
			} else {
				col = 3;
			}
			if (row[col]) {
				console.log('alarm, double content for cell', cell, JSON.stringify(row[col]), 'page:', page.nr);
				console.log(item.items);
				cell[0].t = row[col] + '\n' + cell[0].t;
			}
			while (row.length <= col) row.push(null);
			row[col] = cell[0].t;
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
				var rows_raw = convertToRows(list, page);
				rows_raw.forEach(function (row) {
					if (!isValidRow(row)) {
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
				if (row.length == 4) {
					item = {
						col1: row[0] || '',
						col2: row[1] || '',
						val1: cleanString(row[2]),
						val2: cleanString(row[3])
					};
					final.push(item);
				} else if (item) {
					if (row[0])
						item.col1 = item.col1 + '\n' + (row[0] || '');
					if (row[1])
						item.col2 = item.col2 + '\n' + (row[1] || '');
				} else {
					console.log('alert invalid row', row);
				}
			});
			cb(err, final);
		})
	});
};

exports.parse = parse;

