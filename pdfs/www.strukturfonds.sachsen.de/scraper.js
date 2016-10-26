/*

 Sachsen ERDF 2007-2013
 Download Link: http://www.strukturfonds.sachsen.de/download/FP_0713_Verzeichnis_der_Beguenstigten_Stand_30.06.2016.pdf
 Github Referenz: https://github.com/os-data/eu-structural-funds/issues/38

 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var fs = require("fs");
var PDFToolbox = require('../../lib/pdftoolbox');

var isValidRow = function (row) {

	var _VALUE = 0;
	var _TEXT = 1;
	var _YEAR = 2;

	var valid = [
		[_TEXT, _TEXT, _YEAR, _VALUE, _VALUE],
		[_TEXT, null, _YEAR, _VALUE, _VALUE]
	];

	var isYear = function (cell) {
		if (cell !== null && (cell.indexOf(' ') < 0) && (cell.trim().length == 4) && (/^\d+$/.test(cell.trim()))) {
			var i = parseInt(cell.trim(), 10);
			if (isNaN(i)) return false;
			return i > 1990 && i < 2017;
		}
		return false;
	};

	var isValue = function (cell) {
		return cell !== null && (cell.indexOf('.') >= 0) && !isNaN(cell.replace(/ /g, '').replace(/,/g, '').trim());
	};

	var isText = function (cell) {
		return cell !== null && (!isValue(cell)) && (!isYear(cell));
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

	for (var i = 0; i < valid.length; i++) {
		var format = valid[i];
		if (validateRow(format, row)) {
			return true;
		}
	}
	return false;
};

var scrapePDF = function (item, cb) {
	var pdf = new PDFToolbox();
	pdf.scrape(item, {
		skipPage: [],
		pageToLines: function (page) {
			var lines = PDFToolbox.utils.pageToLines(page, 0.3);
			return PDFToolbox.utils.extractLines(lines, ['in Euro'], ['erstellt am:']);
		},
		processLines: function (lines) {
			return lines;
		},
		linesToRows: function (lines) {

			// console.log(PDFToolbox.utils.xStats(page));
			/*

			 0-150 col 1
			 Name des Begünstigten

			 150-500 col 2
			 BEZEICHNUNG DES VORHABENS

			 500-600 col 3
			 JAHR DER BEWILLIGUNG / RESTZAHLUNG

			 600-700 col 4
			 Bewilligter Betrag

			 700- col 5
			 BEI ABSCHLUSS DES VORHABENS GEZAHLTE GESAMTBETRÄGE

			 */
			return PDFToolbox.utils.extractColumnRows(lines, [150, 500, 600, 700, 1200], 0.2);

		},
		processRows: function (rows) {
			return PDFToolbox.utils.mergeMultiRowsBottomToTop(rows, 2, [0, 1]).filter(function (row) {
				if (!isValidRow(row)) {
					console.log('ALARM, invalid row', JSON.stringify(row));
					return false;
				} else {
					return true;
				}
			});
		},
		rowToFinal: function (row) {
			return {
				_source: item,
				beneficiary: row[0] || '',
				name_of_operation: row[1] || '',
				years: row[2] || '',
				allocated_public_funding: row[3] || '',
				on_finish_total_value: row[4] || ''
			};
		},
		processFinal: function (items) {
			return items;
		}
	}, function (err, items) {
		if (err) console.log(err);
		cb();
	});
};

var scrapeItem = function (item, next) {
	var filename = path.basename(item);
	if (!fs.existsSync(filename)) {
		console.log('scraping doc', item);
		var req = request(item);
		var stream = req.pipe(fs.createWriteStream(filename));
		stream.on('close', function () {
			scrapePDF(item, next);
		});
	} else {
		scrapePDF(item, next);
	}
};

var list = [
	'http://www.strukturfonds.sachsen.de/download/FP_0713_Verzeichnis_der_Beguenstigten_Stand_30.06.2016.pdf'
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
