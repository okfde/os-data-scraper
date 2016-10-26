var fs = require("fs");
var path = require("path");
var async = require("async");
var PDFExtract = require('pdf.js-extract').PDFExtract;
var debugcache = '../../local/_pdf/';
if (!fs.existsSync('../../local/_pdf/')) {
	console.log('warning cache folder doesn\'t exists');
}
var FIELDS = {
	INT: function (cell) {
		return cell !== null && (/^\d+$/.test(cell.trim()));
	},
	YEAR: function (cell) {
		if (cell !== null && (cell.trim().length == 4)) {
			var i = parseInt(cell.trim(), 10);
			if (isNaN(i)) return false;
			return i > 1990 && i < 2017;
		}
		return false;
	},
	YEARS: function (cell) {
		if (!cell) return false;
		cell = cell.trim();
		var parts = cell.split('/');
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i].trim();
			if ((part.length == 4) && (/^\d+$/.test(part))) {
				var i = parseInt(part, 10);
				if (isNaN(i)) return false;
				if (i < 1990 || i > 2017) return false;
			} else return false;
		}
		return true;
	},
	NULL: function (cell) {
		return cell === null;
	},
	VALUE1: function (cell) {
		return cell !== null && (cell.indexOf(',') >= 0) && !isNaN(cell.trim().replace(/\./g, '').replace(/\,/g, '.').replace(/€/g, ''));
	},
	VALUE2: function (cell) {
		return cell !== null && (cell.indexOf(',') >= 0) && (cell.indexOf('€') >= 0) && !isNaN(cell.replace(/\./g, '').replace(/\,/g, '.').replace(/€/g, '').trim());
	},
	VALUE3: function (cell) {
		return cell !== null && (cell.indexOf('.') >= 0) && !isNaN(cell.replace(/ /g, '').replace(/,/g, '').trim());
	},
	DATE: function (cell) {
		return cell !== null && (cell.trim().length == 10) && (/^\d\d\.\d\d\.\d\d\d\d$/.test(cell.trim()));
	}

};


function PDFToolbox() {
}

PDFToolbox.utils = PDFExtract.utils;
PDFToolbox.FIELDS = FIELDS;

PDFToolbox.utils.mergeMultiRowsTopToBottom = function (rows, rowlength, columns) {
	for (var i = 0; i < rows.length - 1; i++) {
		var row = rows[i];
		if (row.length <= rowlength) {
			var rowafter = rows[i + 1];
			columns.forEach(function (column) {
				if (row[column]) {
					if (!rowafter[column]) rowafter[column] = row[column];
					else rowafter[column] = row[column] + '\n' + rowafter[column];
				}
			});
			rows[i] = [];
		}
	}
	return rows.filter(function (row) {
		return row.length > 0;
	})
};

PDFToolbox.utils.mergeMultiRowsBottomToTop = function (rows, rowlength, columns) {
	for (var i = rows.length - 1; i >= 0; i--) {
		var row = rows[i];
		if (row.length <= rowlength) {
			var rowbefore = rows[i - 1];
			columns.forEach(function (column) {
				if (row[column]) {
					if (!rowbefore[column]) rowbefore[column] = row[column];
					else rowbefore[column] = rowbefore[column] + '\n' + row[column];
				}
			});
			rows[i] = [];
		}
	}
	return rows.filter(function (row) {
		return row.length > 0;
	})
};

PDFToolbox.utils.isType = function (cell, cellspec) {
	if (cellspec === null) {
		if (cell !== null) {
			return false;
		}
	} else if (typeof cellspec === 'function') {
		if (!cellspec(cell)) {
			return false;
		}
	} else if (typeof cellspec === 'string') {
		if (cellspec !== cell) {
			return false;
		}
	}
	return true;
};

PDFToolbox.utils.validateRow = function (row, rowspec) {
	if (row.length !== rowspec.length) return false;
	for (var j = 0; j < row.length; j++) {
		if (!PDFToolbox.utils.isType(row[j], rowspec[j])) {
			return false;
		}
	}
	return row.length > 0;
};

PDFToolbox.utils.isValidRow = function (row, rowspecs) {
	for (var i = 0; i < rowspecs.length; i++) {
		if (PDFToolbox.utils.validateRow(row, rowspecs[i])) {
			return true;
		}
	}
	return false;
};

PDFToolbox.prototype.scrape = function (fullfilename, options, cb) {
	console.log('scraping pdf', fullfilename);
	var filename = path.basename(fullfilename).replace('.pdf', '');
	var rows_collect = [];
	var lines_collect = [];
	var pdfExtract = new PDFExtract();
	pdfExtract.extract(filename + '.pdf', {}, function (err, data) {
		if (err) return console.log(err);
		if (options.debug)
			fs.writeFileSync(debugcache + filename + '.pdf.json', JSON.stringify(data, null, '\t'));
		async.forEachSeries(data.pages, function (page, next) {
				if (options.skipPage && options.skipPage.indexOf(page.pageInfo.num) >= 0) return next();
				if (options.debug) {
					fs.writeFileSync(debugcache + filename + '.' + page.pageInfo.num + '.page.json', JSON.stringify(page, null, '\t'));
				}
				var lines = options.pageToLines(page);
				if (lines.length == 0) {
					console.log('ALARM, page', page.pageInfo.num, 'without data');
				} else {
					lines_collect = lines_collect.concat(lines);
				}
				if (options.debug) {
					fs.writeFileSync(debugcache + filename + '.' + page.pageInfo.num + '.lines.json', JSON.stringify(lines, null, '\t'));
				}
				if (options.pageLinesToRows) {
					var rows = options.pageLinesToRows(lines, page);
					rows_collect = rows_collect.concat(rows);
				}
				process.nextTick(function () {
					next();
				});
			},
			function (err) {
				if (err) return console.log(err);
				if (options.debug) {
					fs.writeFileSync(debugcache + filename + '.items.json', JSON.stringify(lines_collect, null, '\t'));
				}
				var rows = [];
				if (options.pageLinesToRows) {
					rows = rows_collect;
				} else {
					if (options.processLines)
						lines_collect = options.processLines(lines_collect);
					rows = options.linesToRows(lines_collect);
				}
				if (options.debug) {
					var sl = rows.map(function (row) {
						return JSON.stringify(row);
					});
					fs.writeFileSync(debugcache + '_' + filename + ".rows.json", '[' + sl.join(',\n') + ']');
				}
				if (options.processRows)
					rows = options.processRows(rows);
				var items = rows.map(function (row) {
					row = row.map(function (cell) {
						return (cell || '').trim();
					});
					return options.rowToFinal(row);
				});
				if (options.processFinal)
					items = options.processFinal(items);
				fs.writeFileSync(filename + ".json", JSON.stringify(items, null, '\t'));
				cb(null, items);
			}
		)
	});
};


module.exports = PDFToolbox;