/*

 Web-Scraper for:

 http://www.esf-vlaanderen.be/nl/projectenkaart

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
			var applyProp = function (s) {
				var parts = s.split(':');
				item[parts[0].trim().toLowerCase().replace(/ /g, '_').replace(/'/g, '_')] = parts.slice(1).join(':').trim();
			};
			$('.group-right .field').each(function (i, elem) {
				applyProp($(elem).text());
			});
			applyProp('Organisatie: ' + $('.group-left .field-name-field-organisation .organization-name').text());
			applyProp('Organisatie street: ' + $('.group-left .field-name-field-organisation .adr .street-address').text());
			applyProp('Organisatie postal code: ' + $('.group-left .field-name-field-organisation .adr .postal-code').text());
			applyProp('Organisatie locality: ' + $('.group-left .field-name-field-organisation .adr .locality').text());
			applyProp('Organisatie url: ' + $('.group-left .field-name-field-organisation .adr .url').text());
			applyProp('Projectverantwoordelijke: ' + $('.group-left .field-name-mf-hcard .family-name').text());
			applyProp('Projectverantwoordelijke tel: ' + $('.group-left .field-name-mf-hcard .tel .value').text());
			applyProp('Projectverantwoordelijke email: ' + $('.group-left .field-name-mf-hcard .email .value').text());
			applyProp('Projectverantwoordelijke email: ' + $('.group-left .field-name-field-partner').text());

			var partners = [];
			$('.group-left .field-name-field-partner li').each(function (i, elem) {
				partners.push($(elem).text());
			});
			applyProp('Partners: ' + partners.join('\n'));

			applyProp($('.group-middle .field-name-field-co-financing-rate-european').text());
			$('.group-middle .group-finance-request .field').each(function (i, elem) {
				applyProp($(elem).text());
			});
			$('.group-middle .group-finance-approval .field').each(function (i, elem) {
				applyProp($(elem).text());
			});
			allitems.push(item);
			next();
		});
};

var scrapePage = function (page) {
	var url = 'http://www.esf-vlaanderen.be/nl/projectenkaart?vrij_zoek=&field_programs_target_id=All&field_themes_target_id=All&province=&field_products_target_id_op=&title_1=&field_call_id_value=&title_2=&title=&field_project_id_value=&field_file_number_value=&field_priority_target_id=All&title_3=&filter_minimum_one_product=&page=';
	console.log('scraping page', url + page);
	scraper(
		{
			url: url + page,
			method: "GET",
			type: "html",
			encoding: "utf-8"
		}
		, function (err, $) {
			if (err) return console.error(err);
			var list = $('.item-list li');
			var items = [];
			list.each(function (i, elem) {
				$elem = $(elem);
				$a = $($('.node-title a', $elem)[0]);
				var o = {};
				var url = $a.attr('href');
				if (url) {
					o._source = 'http://www.esf-vlaanderen.be' + url;
					o.title = $a.text().trim();
					items.push(o);
				}
			});
			async.forEachSeries(items, scrapeItem, function () {
				if (items.length > 0) {
					return scrapePage(page + 1);
				}
				fs.writeFileSync('data.json', JSON.stringify(allitems, null, '\t'));
				console.log('done');
			})
		});
};

scrapePage(0);
