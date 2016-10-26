/**


 Spain:

 PDF: http://www.dgfc.sepg.minhap.gob.es/sitios/dgfc/es-ES/Paginas/BeneficiariosFederCohesion.aspx

 */

var scrapyard = require("scrapyard");
var async = require("async");
var fs = require("fs");
var path = require("path");
var request = require("request");
var PDFToolbox = require('../../lib/pdftoolbox');

var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "600min"
});

var _VALUE = 0;
var _INT = 1;
var _TEXT = 2;
var _YEAR = 3;

var valid = [
	[_TEXT, _TEXT, _VALUE, _VALUE, _YEAR],
	[null, _TEXT, _VALUE, _VALUE, _YEAR],
	[null, _TEXT],
	[_TEXT, _TEXT],
	[null, _YEAR],
	[_TEXT, _YEAR],
	[_TEXT]
];

var isValue = function (cell) {
	return cell !== null && (cell.indexOf(',') >= 0) && !isNaN(cell.trim().replace(/\./g, '').replace(/\,/g, '.'));
};

var isInt = function (cell) {
	return cell !== null && !isNaN(parseInt(cell, 10)) && (/^\d+$/.test(cell.trim()));
};

var isYear = function (cell) {
	if (cell !== null && (cell.indexOf(' ') < 0) && (cell.trim().length == 4)) {
		var i = parseInt(cell.trim(), 10);
		if (isNaN(i)) return false;
		return i > 1990 && i < 2017;
	}
	return false;
};

var isText = function (cell) {
	return cell !== null &&
		(!isValue(cell)) && (!isYear(cell));
};

var isType = function (cell, type) {
	if (type === null) {
		if (cell !== null) {
			return false;
		}
	} else if (type === _INT) {
		if (!isInt(cell)) {
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

var isValidRow = function (row) {
	for (var i = 0; i < valid.length; i++) {
		var format = valid[i];
		if (validateRow(format, row)) {
			return true;
		}
	}
	return false;
};

var scrapePDF = function (item, cb) {
	var skipPage = [1];
	if (item.profile == 'http://www.dgfc.sepg.minhap.gob.es/sitios/dgfc/es-ES/Beneficiarios%20Fondos%20Feder%20y%20Fondos%20de%20Cohesin/PO%20FCH4016.pdf')
		skipPage = [1, 112];
	var pdf = new PDFToolbox();
	pdf.scrape(item.profile, {
		skipPage: skipPage,
		pageToLines: function (page) {
			// console.log('Page:', page.pageInfo.num);
			var lines = PDFToolbox.utils.pageToLines(page, 1.8);
			return PDFToolbox.utils.extractLines(lines, ['operación'], ['-----------------------'/*take all*/]);
		},
		processLines: function (lines) {
			return lines.filter(function (line) {
				if
				(
					(line.length == 3 && line[0].str == 'Total operaciones de ayuda:') ||
					(line.length == 3 && line[0].str == 'Total beneficiario:') ||
					(line.length == 3 && line[0].str == 'Total operaciones de inversión:') ||
					(line.length == 3 && line[0].str == 'TOTAL PROGRAMA:')
				) {
					return false;
				}
				return true;
			});
		},
		linesToRows: function (lines) {
			// console.log(PDFToolbox.utils.xStats(page));
			/*

			 0-300 col 1
			 Nombre beneficiario

			 300-625 col 2
			 Nombre operación

			 625-700 col 3
			 Montante concedido

			 700-800 col 4
			 Montante pagado final operación

			 800- col 5
			 Año de la concesión/año del pago

			 */

			return PDFToolbox.utils.extractColumnRows(lines, [300, 625, 700, 800, 1200], 0.12);
		},
		processRows: function (rows) {
			var result = [];
			rows.forEach(function (row) {
				if (!isValidRow(row)) {
					//special for year in line on next page
					if (validateRow([null, "ACCIONES FORMATIVAS FOMENTO DE LA INTEGRACION SOCIAL ", " 100.000,00", " 66.171,75"], row)) {
						result.push(["AYUNTAMIENTO DE JAEN", "E IGUALDAD DE OPORTUNIDADES. CURSOS", "ACCIONES FORMATIVAS FOMENTO DE LA INTEGRACION SOCIAL ", " 100.000,00", " 66.171,75", "2015"]);
					} else if (validateRow(["AYUNTAMIENTO DE JAEN", "E IGUALDAD DE OPORTUNIDADES. CURSOS", null, null, "2015"], row)) {
						//ignore, handled above
					} else if (validateRow([null, "1,2"], row)) {
						result.push(row);
					} else if (validateRow([null, "07,E.58"], row)) {
						result.push(row);
					} else {
						console.log('ALARM, invalid row', JSON.stringify(row));
					}
				} else {
					result.push(row);
				}
			});
			result = PDFToolbox.utils.mergeMultiRowsBottomToTop(result, 2, [0, 1]);
			return result;
		},
		rowToFinal: function (row) {
			return {
				_source: item.profile,
				nombre_beneficiario: row[0],
				nombre_operacion: row[1],
				montante_concedido: row[2],
				montante_pagado_final_operacion: row[3],
				ano_de_la_concesion: row[4]
			};
		},
		processFinal: function (items) {
			var last = null;
			items.forEach(function (item) {
				if (!last) last = item;
				if (item.nombre_beneficiario.length === 0) {
					item.nombre_beneficiario = last.nombre_beneficiario;
				}
			});
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
	console.log('scraping page', 'http://www.dgfc.sepg.minhap.gob.es/sitios/dgfc/es-ES/Paginas/BeneficiariosFederCohesion.aspx');
	scraper(
		{
			url: 'http://www.dgfc.sepg.minhap.gob.es/sitios/dgfc/es-ES/Paginas/BeneficiariosFederCohesion.aspx',
			method: "GET",
			type: "html",
			encoding: "utf-8"
		}
		, function (err, $) {
			if (err) return console.error(err);
			var list = $('.htmlContenido1P li a');
			var items = [];
			list.each(function (i, elem) {
				var $elem = $(elem);
				var o = {
					title: $elem.text().replace(/\(pdf\)/g, '').trim(),
					profile: 'http://www.dgfc.sepg.minhap.gob.es' + $elem.attr('href'),
					values: {}
				};
				if (o.profile)
					items.push(o);
			});
			async.forEachSeries(items, scrapeItem, function () {
				console.log('done');
			})
		});
};

scrapePage();

