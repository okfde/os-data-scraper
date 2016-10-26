/**


 Spain:

 PDF: http://www.dgfc.sepg.minhap.gob.es/sitios/dgfc/es-ES/Paginas/BeneficiariosFederCohesion.aspx

 */

var scrapyard = require("scrapyard");
var async = require("async");
var fs = require("fs");
var path = require("path");
var request = require("request");
var PDFExtract = require('pdf.js-extract').PDFExtract;

var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "600min"
});

var debug = false;
var debugcache = '../../local/_pdf/';
if (!fs.existsSync('../../local/_pdf/')) {
	console.log('warning cache folder doesn\'t exists');
}

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
	var filename = path.basename(item.profile).replace('.pdf', '');
	console.log('scraping pdf', filename);
	var rows_collect = [];
	var lines_collect = [];
	var pdfExtract = new PDFExtract();
	pdfExtract.extract(filename + '.pdf', {}, function (err, data) {
		if (err) return console.log(err);
		if (debug)
			fs.writeFileSync(debugcache + filename + '.pdf.json', JSON.stringify(data, null, '\t'));
		async.forEachSeries(data.pages, function (page, next) {
				if (page.pageInfo.num == 1) return next();
				// if (page.pageInfo.num !== 2) {
				// 	process.nextTick(function () {
				// 		next();
				// 	});
				// 	return;
				// }
				var lines = PDFExtract.utils.pageToLines(page, 1.8);
				lines = PDFExtract.utils.extractLines(lines, ['operación'], ['-----------------------'/*take all*/]);
				if (lines.length == 0) {
					console.log('ALARM, page', page.pageInfo.num, 'without data');
				} else if (debug) {
					lines_collect = lines_collect.concat(lines);
					fs.writeFileSync(debugcache + filename + '-' + page.pageInfo.num + '.json', JSON.stringify(lines, null, '\t'));
				}


				lines = lines.filter(function (line) {
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

				// console.log(PDFExtract.utils.xStats(page));
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

				var rows = PDFExtract.utils.extractColumnRows(lines, [300, 625, 700, 800, 1200], 0.12);
				rows_collect = rows_collect.concat(rows);
				process.nextTick(function () {
					next();
				});
			},
			function (err) {
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

				var rows = [];
				rows_collect.forEach(function (row) {
					if (!isValidRow(row)) {
						//special for year in line on next page
						if (validateRow([null, "ACCIONES FORMATIVAS FOMENTO DE LA INTEGRACION SOCIAL ", " 100.000,00", " 66.171,75"], row)) {
							rows.push(["AYUNTAMIENTO DE JAEN", "E IGUALDAD DE OPORTUNIDADES. CURSOS", "ACCIONES FORMATIVAS FOMENTO DE LA INTEGRACION SOCIAL ", " 100.000,00", " 66.171,75", "2015"]);
						} else if (validateRow(["AYUNTAMIENTO DE JAEN", "E IGUALDAD DE OPORTUNIDADES. CURSOS", null, null, "2015"], row)) {
							//ignore, handled above
						} else if (validateRow([null, "1,2"], row)) {
							rows.push(row);
						} else if (validateRow([null, "07,E.58"], row)) {
							rows.push(row);
						} else {
							console.log('ALARM, invalid row', JSON.stringify(row));
						}
					} else {
						rows.push(row);
					}
				});

				rows_collect = mergeMultiRows(rows_collect);

				var final = rows_collect.map(function (row) {
					return {
						_source: item.profile,
						nombre_beneficiario: row[0] || '',
						nombre_operacion: row[1] || '',
						montante_concedido: cleanString(row[2] || ''),
						montante_pagado_final_operacion: cleanString(row[3]),
						ano_de_la_concesion: cleanString(row[4])
					};
				});

				var last = null;
				final.forEach(function (item) {
					if (!last) last = item;
					if (item.nombre_beneficiario.length === 0) {
						item.nombre_beneficiario = last.nombre_beneficiario;
					}
				});

				fs.writeFileSync(filename + ".json", JSON.stringify(final, null, '\t'));
				cb(err);
			}
		)
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

