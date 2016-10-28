/*

 Österreich ESF 2007-2013 - ähnlich wie bei Rheinland-Pfalz - mehrere PDFs (pro Jahr) die gepoolt werden müssen
 https://github.com/os-data/eu-structural-funds/issues/42

 http://www.esf.at/esf/wp-content/uploads/Verzeichnis-der-Beg%C3%BCnstigten-2014.pdf
 http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beguenstigten-2013.pdf
 http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beg%C3%BCnstigten-2012.pdf
 http://www.esf.at/esf/wp-content/uploads/20120827_Liste-der-ESF-Beg%C3%BCnstigten-20111.pdf
 http://www.esf.at/esf/wp-content/uploads/2010-ESF_Verzeichnis_Beg%C3%BCnstigte_%C3%96sterreich.pdf
 http://www.esf.at/esf/wp-content/uploads/2011/02/List-of-Beneficiaries_2009.pdf
 http://www.esf.at/esf/wp-content/uploads/ESF-List-of-Beneficiaries-Austria-2007-2008.pdf

 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var fs = require("fs");
var PDFToolbox = require('../../lib/pdftoolbox');

var Format2013 = function () {
	var _VALUE = PDFToolbox.FIELDS.VALUE1;
	var _TEXT = function (cell) {
		return cell && !_VALUE(cell);
	};
	var rowspecs = [
		[_TEXT, _TEXT, _VALUE]
	];

	this.scrapePDF = function (item, cb) {
		var pdf = new PDFToolbox();
		pdf.scrape(item.url, {
			debug: false,
			skipPage: [],
			pageToLines: function (page) {
				var lines = PDFToolbox.utils.pageToLines(page, 4);
				if (page.pageInfo.num == 1) {
					lines = PDFToolbox.utils.extractLines(lines, ['Euro'], ['-------------'/* take all */]);
				}
				if (lines.length > 0 && lines[lines.length - 1].length == 1) {
					//skipping page footer
					lines = lines.slice(0, lines.length - 1);
				}
				return lines;
			},
			processLines: function (lines) {
				return lines;
			},
			linesToRows: function (lines) {
				// console.log(PDFToolbox.utils.xStats(page));
				/*

				 0-300 col 1
				 Beneficiary

				 300-600 col 2
				 Name of the operation

				 600- col 3
				 EU-, national and private funding*
				 * total cost

				 */

				return PDFToolbox.utils.extractColumnRows(lines, [300, 600, 1200], 5);
			},
			processRows: function (rows) {
				rows = PDFToolbox.utils.mergeMultiRowsBottomToTop(rows, 2, [0, 1]);
				return rows.filter(function (row) {
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
					_source: item.url,
					beneficiary: row[0] || '',
					name_of_operation: row[1] || '',
					funding_total_cost: row[2] || ''
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
};

var scrapePDF = function (item, next) {
	if (item.format) {
		item.format = new item.format();
		item.format.scrapePDF(item, next);
	} else {
		console.log('TODO: format for ', item.url);
		next();
	}
};

var scrapeItem = function (item, next) {
	var filename = path.basename(item.url);
	if (!fs.existsSync(filename)) {
		console.log('scraping doc', item.url);
		var req = request(item.url);
		var stream = req.pipe(fs.createWriteStream(filename));
		stream.on('close', function () {
			scrapePDF(item, next);
		});
	} else {
		scrapePDF(item, next);
	}
};

var list = [
	{url: 'http://www.esf.at/esf/wp-content/uploads/2010-ESF_Verzeichnis_Beg%C3%BCnstigte_%C3%96sterreich.pdf', format: null},
	{url: 'http://www.esf.at/esf/wp-content/uploads/Verzeichnis-der-Beg%C3%BCnstigten-2014.pdf', format: null},
	{url: 'http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beguenstigten-2013.pdf', format: Format2013},
	{url: 'http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beg%C3%BCnstigten-2012.pdf', format: null},
	{url: 'http://www.esf.at/esf/wp-content/uploads/20120827_Liste-der-ESF-Beg%C3%BCnstigten-20111.pdf', format: null},
	{url: 'http://www.esf.at/esf/wp-content/uploads/2011/02/List-of-Beneficiaries_2009.pdf', format: null},
	{url: 'http://www.esf.at/esf/wp-content/uploads/ESF-List-of-Beneficiaries-Austria-2007-2008.pdf', format: null}
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
