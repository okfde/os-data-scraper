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

var _VALUE = PDFToolbox.FIELDS.VALUE1;
var _YEARS = PDFToolbox.FIELDS.YEARS;
var _INT = PDFToolbox.FIELDS.INT;
var _TEXT = function (cell) {
	return cell && !_YEARS(cell) && !_VALUE(cell) && !_INT(cell);
};
var rowspecs = [
	[_INT, _TEXT, _TEXT, _YEARS, _VALUE, _VALUE],
	[_INT, _TEXT, _TEXT, _YEARS, _VALUE]
];

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
