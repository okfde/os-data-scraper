/*

 ERDF Data Schleswig Holstein 2007-2013
 Download Link: http://www.ib-sh.de/fileadmin/user_upload/downloads/Arbeit_Bildung/ZP_Wirtschaft/Verzeichnis_der_Beguenstigten_im_Zukunftsprogramm_Wirtschaft_in_der_Foerderperiode_2007-2013.pdf
 Startseite: https://www.schleswig-holstein.de/DE/Fachinhalte/F/foerderprogramme/MWAVT/efre_inSH_2014_2020.html



 ERDF Data NRW 2007-2013
 Download Link: http://www.ziel2.nrw.de/1_NRW-EU_Ziel_2_Programm_2007-2013/3_Ergebnisse/Verzeichnis_Beguenstigte_2014_12_31.pdf
 Startseite: https://www.efre.nrw.de/

 ESF Data Schleswig Holstein 2007-2013
 Download link: http://www.ib-sh.de/fileadmin/user_upload/downloads/Arbeit_Bildung/ZP_Arbeit/allgemein/vdb.pdf
 Startseite: http://www.ib-sh.de/die-ibsh/foerderprogramme-des-landes/landesprogramm-arbeit/



 Sachsen ERDF 2007-2013
 Download Link: http://www.strukturfonds.sachsen.de/download/FP_0713_Verzeichnis_der_Beguenstigten_Stand_30.06.2016.pdf
 Github Referenz: https://github.com/os-data/eu-structural-funds/issues/38

 Thüringen ESF 2007-2013
 Download Link: http://www.esf-thueringen.de/imperia/md/content/esf/dastmwtaundderesf/listederbeguenstigten/liste_der_beguenstigten_2014.pdf
 Github Referenz: https://github.com/os-data/eu-structural-funds/issues/41

 Rheinland Pfalz ESF 2007-2013 - hier gibt es sechs einzelne PDFs (pro Jahr) die sind im Github ersichtlich und müssten dann zusammen ein finales Dokument ergeben
 https://github.com/os-data/eu-structural-funds/issues/36


 Österreich ESF 2007-2013 - ähnlich wie bei Rheinland-Pfalz - mehrere PDFs (pro Jahr) die gepoolt werden müssen
 https://github.com/os-data/eu-structural-funds/issues/42


 Saarland ESF 2007-2013
 Download link: http://www.saarland.de/dokumente/tp_sff/Beguenstigtenverzeichnis_13_14.pdf
 Github Referenz: https://github.com/os-data/eu-structural-funds/issues/37




 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var fs = require("fs");
var PDFExtract = require('pdf.js-extract').PDFExtract;

var debug = false;
var debugcache = '../../local/_pdf/';
if (!fs.existsSync('../../local/_pdf/')) {
	console.log('warning cache folder doesn\'t exists');
}

var isValidRow = function (row) {

	var _VALUE = 0;
	var _TEXT = 1;

	var valid = [
		[_TEXT, _TEXT, _TEXT, _VALUE, _VALUE],
		[_TEXT, _TEXT, _TEXT, null, _VALUE],
		[_TEXT, _TEXT, _TEXT, _VALUE],
		// [_TEXT, _TEXT],
		// [null, _TEXT],
		// [_TEXT]
	];


	var isValue = function (cell) {
		return cell !== null && (cell.indexOf(',') >= 0) && (cell.indexOf('€') >= 0) && !isNaN(cell.replace(/\./g, '').replace(/\,/g, '.').replace(/€/g, '').trim());
	};

	var isText = function (cell) {
		return cell !== null && (!isValue(cell));
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

var mergeMultiRows = function (rows) {
	for (var i = rows.length - 1; i >= 0; i--) {
		var row = rows[i];
		if (row.length <= 2) {
			var rowbefore = rows[i - 1];
			if (row[0]) {
				if (!rowbefore[0]) rowbefore[0] = row[0];
				else rowbefore[0] = rowbefore[0] + '\n' + row[0];
			}
			if (row[1]) {
				if (!rowbefore[1]) rowbefore[1] = row[1];
				else rowbefore[1] = rowbefore[1] + '\n' + row[1];
			}
			rows[i] = [];
		}
	}
	return rows.filter(function (row) {
		return row.length > 0;
	})
};

var scrapePDF = function (item, cb) {
	var filename = path.basename(item).replace('.pdf', '');
	console.log('scraping pdf', filename);
	var rows_collect = [];
	var lines_collect = [];
	var pdfExtract = new PDFExtract();
	pdfExtract.extract(filename + '.pdf', {}, function (err, data) {
		if (err) return console.log(err);
		if (debug)
			fs.writeFileSync(debugcache + filename + '.pdf.json', JSON.stringify(data, null, '\t'));
		async.forEachSeries(data.pages, function (page, next) {
			var lines = PDFExtract.utils.pageToLines(page, 0.12);
			lines = PDFExtract.utils.extractLines(lines, ['RESTZAHLUNG'], ['Seite ']);
			if (lines.length == 0) {
				console.log('ALARM, page', page.pageInfo.num, 'without data');
			} else if (debug) {
				lines_collect = lines_collect.concat(lines);
				fs.writeFileSync(debugcache + filename + '-' + page.pageInfo.num + '.json', JSON.stringify(lines, null, '\t'));
			}
			// console.log(PDFExtract.utils.xStats(page));
			/*

			 0-150 col 1
			 NAME DES/DER BEGÜNSTIGSTEN

			 150-300 col 2
			 BEZEICHNUNG DES VORHABENS

			 300-390 col 3
			 JAHR DER BEWILLIGUNG / RESTZAHLUNG

			 390-480 col 4
			 GEWÄHRTE BETRÄGE

			 480-
			 BEI ABSCHLUSS DES VORHABENS GEZAHLTE GESAMTBETRÄGE

			 */

			var rows = PDFExtract.utils.extractColumnRows(lines, [150, 300, 390, 480, 1000], 0.12);
			rows = mergeMultiRows(rows).filter(function (row) {
				if (!isValidRow(row)) {
					console.log('ALARM, invalid row', JSON.stringify(row));
					return false;
				} else {
					return true;
				}
			});
			rows_collect = rows_collect.concat(rows);
			next();
		}, function (err) {
			if (err) return console.log(err);
			if (debug) {
				fs.writeFileSync(debugcache + '_' + filename + '.items.json', JSON.stringify(lines_collect, null, '\t'));
				var sl = rows_collect.map(function (row) {
					return JSON.stringify(row);
				});
				fs.writeFileSync(debugcache + '_' + filename + ".rows.json", '[' + sl.join(',\n') + ']');
			}
			var cleanString = function (cell) {
				return (cell || '').trim();
			};
			var final = rows_collect.map(function (row) {
				return {
					_source: item,
					col1: row[0] || '',
					col2: row[1] || '',
					year: row[2] || '',
					val1: cleanString(row[3]),
					val2: cleanString(row[4])
				};
			});
			fs.writeFileSync(filename + ".json", JSON.stringify(final, null, '\t'));
			cb(err);
		})
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
	'http://www.ib-sh.de/fileadmin/user_upload/downloads/Arbeit_Bildung/ZP_Wirtschaft/Verzeichnis_der_Beguenstigten_im_Zukunftsprogramm_Wirtschaft_in_der_Foerderperiode_2007-2013.pdf'
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
