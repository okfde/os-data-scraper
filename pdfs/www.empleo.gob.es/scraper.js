/*

 Data: http://www.empleo.gob.es/uafse/es/beneficiarios/index.html

 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var fs = require("fs");
var PDFToolbox = require('../../lib/pdftoolbox');

var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "600min"
});


var _VALUE = PDFToolbox.FIELDS.VALUE1;
var _TEXT = function (cell) {
	return cell && !_VALUE(cell);
};
var rowspecs = [
	[_TEXT, _TEXT, _VALUE],
	[null, _TEXT]
];

var scrapePDF = function (item, cb) {
	var pdf = new PDFToolbox();
	var saveFinal = true;
	if (item.profile == 'http://www.empleo.gob.es/uafse/es/beneficiarios/2016-pdf/PO_FSE_ADAPTABILIDAD_Y_EMPLEO.pdf') {
		saveFinal = false;
	}
	pdf.scrape(item.profile, {
		// debug: true,
		skipPage: [],
		pageToLines: function (page) {
			var lines = PDFToolbox.utils.pageToLines(page, 0.12);
			lines = PDFToolbox.utils.extractLines(lines,
				[" PÚBLICO"],
				["- - - - - - - -"] // take all
			);
			if (lines.length > 0 && lines[lines.length - 1].length > 0 && lines[lines.length - 1][1].str.indexOf('Página') >= 0) {
				lines = lines.slice(0, lines.length - 1);
			}
			// console.log(PDFToolbox.utils.xStats(page));
			return lines;
		},
		processLines: function (lines) {
			// console.log(lines);
			return lines;
		},
		linesToRows: function (lines) {
			/*

			 0-190 col 1
			 BENEFICIARIO

			 190-500 col 2
			 TIPO DE OPERACIÓN

			 500- col 3
			 GASTO PÚBLICO

			 */

			return PDFToolbox.utils.extractColumnRows(lines, [190, 500, 2000], 0.28);
		},
		processRows: function (rows) {
			return PDFToolbox.utils.mergeMultiRowsBottomToTop(rows, 2, [1]).filter(function (row) {
					if (!PDFToolbox.utils.isValidRow(row, rowspecs)) {
						console.log('ALARM, invalid row', JSON.stringify(row));
						return false;
					} else {
						return true;
					}
				}
			);
		},
		rowToFinal: function (row) {
			return {
				_source: item.profile,
				_title: item.title,
				beneficiary: row[0] || '',
				operation: row[1] || '',
				spending: row[2] || ''
			};
		},
		saveFinal: saveFinal,
		processFinal: function (items) {
			if (!saveFinal) {
				var filename = path.basename(item.profile).replace('.pdf', '');
				var total = 0;
				for (var i = 0; i < 100; i++) {
					var part = items.slice(i * 100000, ((i + 1) * 100000));
					if (part.length > 0) {
						total += part.length;
						fs.writeFileSync(filename + '_' + (i + 1) + ".json", JSON.stringify(part, null, '\t'));
					}
				}
				console.log(items.length, total);


			}
			return items;
		}
	}, function (err, items) {
		if (err) console.log(err);
		cb();
	});
};

var scrapeItem = function (item, next) {
	var filename = path.basename(item.profile);
	if (!fs.existsSync(filename)) {
		console.log('scraping doc', item.profile);
		var req = request(item.profile);
		var stream = req.pipe(fs.createWriteStream(filename));
		stream.on('close', function () {
			scrapePDF(item, next);
		});
	} else {
		scrapePDF(item, next);
	}
};

var scrapePage = function () {
	console.log('scraping page', 'http://www.empleo.gob.es/uafse/es/beneficiarios/index.html');
	scraper(
		{
			url: 'http://www.empleo.gob.es/uafse/es/beneficiarios/index.html',
			method: "GET",
			type: "html",
			encoding: "utf-8"
		}
		, function (err, $) {
			if (err) return console.error(err);
			var list = $('.conten_presen_mapa tr ');
			var items = [];
			list.each(function (i, elem) {
				var $elem = $(elem);
				var u = $('td a', $elem).attr('href');
				var o = {
					title: $('td', $elem).text().replace(/\(pdf\)/g, '').trim(),
					profile: 'http://www.empleo.gob.es/uafse/es/beneficiarios/' + u,
					values: {}
				};
				if (u)
					items.push(o);
			});
			async.forEachSeries(items, scrapeItem, function () {
				console.log('done');
			})
		});
};

scrapePage();

