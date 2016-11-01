/*

 Web-Scraper for:

 https://www.itms2014.sk/projekty-v-realizacii#_i=&_s=1&_f=4010&_o=false

 */

var scrapyard = require("scrapyard");
var async = require("async");
var fs = require("fs");
var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "6000min"
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
			// console.log($.html());

			var applyProp = function (key, s) {
				item[key.trim().toLowerCase().replace(/ /g, '_').replace(/'/g, '_')] = s;
			};

			var items = $('.fieldset-group');

			items.each(function (i, div) {
				// console.log('----------------------');
				var section = $('h2', div).text();
				// console.log('section', section);
				var fieldsets = $('fieldset', div);
				fieldsets.each(function (j, fieldset) {
					var group = $('> legend', fieldset).text().trim();
					// console.log('group', group);
					var formgroups = $('.form-group', fieldset);
					formgroups.each(function (k, formgroup) {
						var name = $('label', formgroup).text().trim();
						var value = $('.form-control-static', formgroup).text().trim();
						// var a = $('.form-control-static a', formgroup);
						// console.log($(a).attr('href'));
						applyProp([section, group, name].join('-'), value);
					});
				});
			});
			allitems.push(item);
			next();
		});
};

var scrapePage = function (page) {
	var url = 'https://www.itms2014.sk/projekty-v-realizacii?-0.ILinkListener-alzaFilterMainContainer-facetFilterLazyContainer-content-resultContainer-loadMoreLink&hash=%23_i%3D%26_s%3D1%26_f%3D' + page + '%26_o%3Dfalse';
	console.log('scraping page', url);
	scraper(
		{
			url: url,
			method: "GET",
			type: "html",
			encoding: "utf-8"
		}
		, function (err, $) {
			if (err) return console.error(err);
			var html = $('component').html().replace(' <!--[CDATA[', '').replace(']]-->', '');
			var list = $('a', $(html));
			var items = [];
			list.each(function (i, elem) {
				$a = $(elem);
				var o = {};
				var url = $a.attr('href');
				if (url && (url.indexOf('projekt?id=') >= 0)) {
					o._source = 'https://www.itms2014.sk/' + url.replace('./', '');
					items.push(o);
				}
			});
			async.forEachSeries(items, scrapeItem, function () {
				if (items.length > 0) {
					return scrapePage(page + 10);
				}
				fs.writeFileSync('data.json', JSON.stringify(allitems, null, '\t'));
				console.log('done', allitems.length);
			})
		});
};

scrapePage(0);
