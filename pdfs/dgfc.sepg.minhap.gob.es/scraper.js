/**


 Spain:

 PDF: http://www.dgfc.sepg.minhap.gob.es/sitios/dgfc/es-ES/Paginas/BeneficiariosFederCohesion.aspx

 */

var scrapyard = require("scrapyard");
var async = require("async");
var fs = require("fs");
var path = require("path");
var request = require("request");
var parser = require('./parser.js');

var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "600min"
});

var scrapePDF = function (item, next) {
	var filename = path.basename(item.profile).replace('.pdf', '');
	console.log('scraping pdf', filename);
	parser.parse(filename + '.pdf', function (err, items) {
		items = items.map(function (i) {
			return {
				_source: item.profile,
				nombre_beneficiario: i.col1,
				nombre_operacion: i.col2,
				montante_concedido: i.val1,
				montante_pagado_final_operacion: i.val2,
				ano_de_la_concesion: i.year
			};
		})

		fs.writeFileSync(filename + ".json", JSON.stringify(items, null, '\t'));
		next();
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
