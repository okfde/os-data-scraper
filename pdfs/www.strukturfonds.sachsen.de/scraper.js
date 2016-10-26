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

var _VALUE = PDFToolbox.FIELDS.VALUE3;
var _YEAR = PDFToolbox.FIELDS.YEAR;
var _TEXT = function (cell) {
	return cell && !_VALUE(cell) && !_YEAR(cell);
};
var rowspecs = [
	[_TEXT, _TEXT, _YEAR, _VALUE, _VALUE],
	[_TEXT, null, _YEAR, _VALUE, _VALUE]
];

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
				if (!PDFToolbox.utils.isValidRow(row, rowspecs)) {
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
