/*

 Web-Scraper for:
 http://www.empleo.gob.es/uafse/es/proyectos/todos/index.html

 */

var scrapyard = require("scrapyard");
var async = require("async");
var fs = require("fs");

var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "600min"
});

var final = [];

var scrapeItem = function (item, next) {
	console.log('scraping profile', item._source);
	scraper({
			url: item._source,
			method: "GET",
			type: "html",
			encoding: "utf-8"
		},
		function (err, $) {
			if (err) return console.error(err);
			var box = $('#columna_izquierda table');
			box.children().each(function (i, elem) {
				var $elem = $(elem);
				var cat = $('.izq', $elem).text().trim();
				var value = $('.der', $elem).text().trim();
				item[cat] = value;
			});
			var box = $('.tabla_proyectos');
			box.children().each(function (i, elem) {
				var $elem = $(elem);
				if ($('.tabla_gris', $elem).attr('colspan') != 2) {
					var cat = $('.tabla_gris', $elem).text().trim();
					var value = $($('td', $elem)[1]).text().trim();
					if (value !== '')
						item[cat] = value;
				}
			});
			final.push(item);
			next();
		});
};

var scrapePage = function () {
	console.log('scraping page');
	scraper(
		{
			url: 'http://www.empleo.gob.es/uafse/es/proyectos/todos/index.html',
			method: "GET",
			type: "html",
			encoding: "utf-8"
		}
		, function (err, $) {
			if (err) return console.error(err);
			var items = [];
			$('#centro_tipoC table').each(function (i, elem) {
				$elem = $(elem);
				if (i == 0) {
					// $('th', $elem).each(function (i, elem) {
					// 	columns.push($(elem).text());
					// });
				} else {
					var o = {};
					// o.title = $('a', $elem).text().trim();
					o._source = 'http://www.empleo.gob.es/uafse/es/proyectos/todos/' + $('a', $elem).attr('href');
					items.push(o);
				}
			});
			async.forEachSeries(items, scrapeItem, function () {
				fs.writeFileSync('data.json', JSON.stringify(final, null, '\t'));
				console.log('done');
			})
		});
};

scrapePage();

