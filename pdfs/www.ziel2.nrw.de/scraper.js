/*

 ERDF Data NRW 2007-2013
 Download Link: http://www.ziel2.nrw.de/1_NRW-EU_Ziel_2_Programm_2007-2013/3_Ergebnisse/Verzeichnis_Beguenstigte_2014_12_31.pdf
 Startseite: https://www.efre.nrw.de/

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
		[_TEXT, _TEXT, _YEAR, _VALUE],
		// [_TEXT, _TEXT, _TEXT, null, _VALUE],
		// [_TEXT, _TEXT, _TEXT, _VALUE],
		// [_TEXT, _TEXT],
		// [null, _TEXT],
		// [_TEXT]
	];

	var isYear = function (cell) {
		if (cell !== null && (cell.indexOf(' ') < 0) && (cell.trim().length == 4) && (/^\d+$/.test(cell))) {
			var i = parseInt(cell.trim(), 10);
			if (isNaN(i)) return false;
			return i > 1990 && i < 2017;
		}
		return false;
	};

	var isValue = function (cell) {
		if (cell !== null && /^\d+$/.test(cell.replace(/\./g, '').trim())) {
			var i = parseInt(cell.replace(/\./g, '').trim(), 10);
			if (isNaN(i)) return false;
			return true;// i < 1990 || i > 2017;
		}
		return false;
	};

	var isText = function (cell) {
		return cell !== null && (!isValue(cell)) && (!isYear(cell));
	};

	var isType = function (cell, type) {
		if (type === null) {
			if (cell !== null) {
				return false;
			}
		} else if (type === _YEAR) {
			if (!isYear(cell)) {
				return false;
			}
		} else if (type === _VALUE) {
			if (!isValue(cell)) {
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
			if (page.pageInfo.num == 1)
				lines = PDFToolbox.utils.extractLines(lines, ['der Restzahlung'], ['Seite ']);
			else
				lines = PDFToolbox.utils.extractLines(lines, ['Stand '], ['Seite ']);
			return lines;
		},
		processLines: function (lines) {
			return lines;
		},
		linesToRows: function (lines) {
			// console.log(PDFExtract.utils.xStats(page));
			/*

			 0-208 col 1
			 Name des Begünstigten

			 208-540 col 2
			 BEZEICHNUNG DES VORHABENS

			 540-650 col 3
			 JAHR DER BEWILLIGUNG / RESTZAHLUNG

			 650- col 4
			 Bewilligter Betrag
			 // string merged with
			 BEI ABSCHLUSS DES VORHABENS GEZAHLTE GESAMTBETRÄGE

			 */

			return PDFToolbox.utils.extractColumnRows(lines, [208, 540, 650, 1200], 0.6);
		},
		processRows: function (rows) {
			rows.forEach(function (row) {
				[0, 2, 3].forEach(function (i) {
					if (row[i] && row[i].indexOf('    ') >= 0) {
						var parts = row[i].split('    ').filter(function (part) {
							return part.trim().length > 0;
						});
						if (parts.length !== 2) console.log('warning multiple merge cell!', row);
						else {
							row[i] = parts[0].trim();
							row[i + 1] = (parts[1] + (row[i + 1] || '')).trim();
						}
					}
				});
			});
			return PDFToolbox.utils.mergeMultiRowsTopToBottom(rows, 3, [0, 1]).filter(function (row) {
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
	console.log('scraping pdf', item);
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
	'http://www.ziel2.nrw.de/1_NRW-EU_Ziel_2_Programm_2007-2013/3_Ergebnisse/Verzeichnis_Beguenstigte_2014_12_31.pdf'
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
