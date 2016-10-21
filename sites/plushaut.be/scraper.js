/*
  Scraper for

  http://www.plushaut.be/projets

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

var allitems = [];

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

			item.projects = [];
			var box = $('.node-projet > .field');

			box.each(function (i, elem) {
				var $elem = $(elem);
				var cat = $('.field-label', $elem).text().trim().split(':')[0];
				var values = [];
				$('.field-items', $elem).each(function (i, elem) {
					values.push($(elem).text().trim())
				});
				values = values.filter(function (val) {
					return val.length > 0;
				});
				if (cat.length > 0 && ['Webtv', 'Projet(s)', 'Communiqué(s)'].indexOf(cat) < 0) {
					item[cat] = values;
				}
				if (cat == 'Projet(s)') {
					var p = {};
					var p_box = $('.content .field', $elem);
					p_box.each(function (i, elem) {
						var $elem = $(elem);
						var cat = $('.field-label', $elem).text().trim().split(':')[0];
						var values = [];
						$('.field-items', $elem).each(function (i, elem) {
							values.push($(elem).text().trim())
						});
						values = values.filter(function (val) {
							return val.length > 0;
						});
						p[cat] = values;
					});
					item.projects.push(p);
				}
			});

			allitems.push(item);
			next();
		});
};

var scrapePage = function (page) {
	console.log('scraping page', page);
	scraper(
		{
			url: page,
			method: "GET",
			type: "html",
			encoding: "utf-8"
		}
		, function (err, $) {
			if (err) return console.error(err);
			var nextlink = $('.next a').attr('href');
			var list = $('.node-projet');
			var items = [];
			list.each(function (i, elem) {
				$elem = $(elem);
				$title = $('.title', $elem);
				var o = {};
				o.title = $title.text().trim();
				o._source = 'http://www.plushaut.be' + $elem.attr('about');
				if (o._source)
					items.push(o);
			});
			async.forEachSeries(items, scrapeItem, function () {
				if (nextlink) {
					return scrapePage('http://www.plushaut.be' + nextlink);
				}
				fs.writeFileSync('data.json', JSON.stringify(allitems, null, '\t'));
				console.log('done');
			})
		});
};

scrapePage('http://www.plushaut.be/projets');
