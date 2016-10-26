/*

 Saarland ESF 2007-2013
 Download link: http://www.saarland.de/dokumente/tp_sff/Beguenstigtenverzeichnis_13_14.pdf
 Github Referenz: https://github.com/os-data/eu-structural-funds/issues/37

 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var fs = require("fs");
var PDFToolbox = require('../../lib/pdftoolbox');


var _VALUE = function (cell) {
	return cell && (PDFToolbox.FIELDS.VALUE1(cell) || PDFToolbox.FIELDS.INT(cell));
};
var _DATE = PDFToolbox.FIELDS.DATE;
var _TEXT = function (cell) {
	return cell && !_VALUE(cell) && !_DATE(cell);
};
var rowspecs = [
	[_TEXT, _DATE, _DATE, _VALUE]
];

var scrapePDF = function (item, cb) {
	var pdf = new PDFToolbox();
	pdf.scrape(item, {
		skipPage: [],
		pageToLines: function (page) {
			var alllines = PDFToolbox.utils.pageToLines(page, 0.3);
			var lines = PDFToolbox.utils.extractLines(alllines, ['Name des Projekte'], ['-------------------'/*take all*/]);
			if (lines.length == 0) lines = PDFToolbox.utils.extractLines(alllines, ['Begünstigtenverzeichnis '], ['-------------------'/*take all*/]);
			lines = lines.filter(function (line) {
				if ((line.length == 1) && (line[0].str == ' ')) {
					return false;
				}
				if ((line.length == 2) && (!isNaN(parseInt(line[0].str.trim(), 10))) && (line[1].str == ' ')) {
					return false;
				}

				if ((line.length == 4) && (line[1] == null) && (line[3] == null)) {
					return false;
				}
				if ((line.length == 4) && (line[0].str == ' ') && (line[1].str == ' ') && (line[3].str == ' ')) {
					return false;
				}
				return true;
			});
			return lines;
		},
		processLines: function (lines) {
			return lines;
		},
		linesToRows: function (lines) {
			// console.log(PDFExtract.utils.xStats(page));

			// console.log(page.pageInfo.num);

			/*

			 0-450 col 1
			 Name des Begünstigten

			 450-500 col 2
			 Projektlaufzeit: von

			 500-550 col 3
			 Projektlaufzeit: bis

			 700- col 4
			 ESF Mittel

			 */

			var rows = PDFToolbox.utils.extractColumnRows(lines, [450, 500, 550, 700, 1200], 0.4);
			return rows.map(function (row) {
				return row.filter(function (cell) {
					return (!cell) || (cell !== ' ');
				});
			});
		},
		processRows: function (rows) {
			return PDFToolbox.utils.mergeMultiRowsBottomToTop(rows, 1, [0]).filter(function (row) {
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
				year_from: row[1] || '',
				year_until: row[2] || '',
				esf_funds: row[3] || ''
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
	'http://www.saarland.de/dokumente/tp_sff/Beguenstigtenverzeichnis_13_14.pdf'
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
