/*

 Rheinland Pfalz ESF 2007-2013 - hier gibt es sechs einzelne PDFs (pro Jahr) die sind im Github ersichtlich und müssten dann zusammen ein finales Dokument ergeben
 https://github.com/os-data/eu-structural-funds/issues/36

 http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2008.pdf
 http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2009.pdf
 http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2010_Stand_06.06.2011.pdf
 http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2011_Bewilligung_2011.pdf
 http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2013.pdf
 http://esf.rlp.de/fileadmin/esf/Dokumente/Verzeichnis_der_Beg%C3%BCnstigten/140630_Verzeichnis_der_Beg%C3%BCnstigten_2013.pdf

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
	var _INT = 3;

	var valid = [
		[_INT, _TEXT, _TEXT, _YEAR, _VALUE, _VALUE],
		[_INT, _TEXT, _TEXT, _YEAR, _VALUE]
	];

	var isYear = function (cell) {
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
	};

	var isInt = function (cell) {
		return cell !== null && !isNaN(parseInt(cell, 10)) && (/^\d+$/.test(cell.trim()));
	};

	var isValue = function (cell) {
		return cell !== null && (cell.indexOf(',') >= 0) && !isNaN(cell.replace(/\./g, '').replace(/,/g, '.').trim());
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
				console.log(cell, 'is not year');
				return false;
			}
		} else if (type === _INT) {
			if (!isInt(cell)) {
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
			return PDFToolbox.utils.extractLines(lines, ['Restzahlung'], ['erstellt mit EurekaRLP']);
		},
		processLines: function (lines) {
			return lines;
		},
		linesToRows: function (lines) {
			// console.log(PDFExtract.utils.xStats(page));
			/*

			 0-40 col 1
			 lfd. Nr.

			 40-200 col 2
			 Name des Begünstigten

			 200-400 col 2
			 BEZEICHNUNG DES VORHABENS

			 400-500 col 3
			 JAHR DER BEWILLIGUNG / RESTZAHLUNG

			 500-630 col 4
			 Bewilligter Betrag

			 630- col 5
			 BEI ABSCHLUSS DES VORHABENS GEZAHLTE GESAMTBETRÄGE

			 */
			return PDFToolbox.utils.extractColumnRows(lines, [42, 200, 400, 500, 560, 1200], 0.2);
		},
		processRows: function (rows) {
			rows = rows.filter(function (row) {
				return (row[0] || row[1] !== 'Summe Insgesamt');
			});
			return PDFToolbox.utils.mergeMultiRowsBottomToTop(rows, 3, [1, 2]).filter(function (row) {
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
				beneficiary: row[1],
				name_of_operation: row[2],
				years: row[3],
				allocated_public_funding: row[4],
				on_finish_total_value: (row[5] || '')
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
	'http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2008.pdf',
	'http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2009.pdf',
	'http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2010_Stand_06.06.2011.pdf',
	'http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2011_Bewilligung_2011.pdf',
	'http://esf.rlp.de/fileadmin/esf/Dokumente/VdB_2013.pdf',
	'http://esf.rlp.de/fileadmin/esf/Dokumente/Verzeichnis_der_Beg%C3%BCnstigten/140630_Verzeichnis_der_Beg%C3%BCnstigten_2013.pdf'
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
