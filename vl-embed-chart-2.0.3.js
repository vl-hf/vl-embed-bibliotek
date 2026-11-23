/*! VL embed-bygger 2.0.3 – graf-runtime for chart@3.
    Generert fra chart-template.html av library/build_library.py. Ikke rediger denne fila direkte.
    Lastes én gang per side og tegner alle .vl-chart-embed-v3, også embeds som legges til senere.
    Bruker Chart.js 4.5.1 (MIT-lisens) fra chartjs-4.5.1.min.js i samme mappe. */
(function () {
  "use strict";

  var GLOBAL_KEY = "__vlEmbedChart3";
  if (window[GLOBAL_KEY] && typeof window[GLOBAL_KEY].scan === "function") {
    window[GLOBAL_KEY].scan();
    return;
  }

  var current = document.currentScript;
  var BASE = current && current.src ? current.src.replace(/[^\/?#]*(?:[?#].*)?$/, "") : "";
  var CHARTJS_URL = BASE + "chartjs-4.5.1.min.js";

  function initRoot(root) {


    const ALLOWED_TYPES = new Set(["bar", "line", "doughnut", "scatter"]);
    const ALLOWED_DATASET_TYPES = new Set(["bar", "line"]);
    const ALLOWED_POINT_STYLES = new Set(["circle", "rect", "rectRounded", "triangle", "star", "cross", "crossRot"]);
    const PALETTE = {
      red: "#c11520",
      blue: "#3d6fa3",
      teal: "#2f7f75",
      gold: "#c6912d",
      violet: "#765e8d",
      slate: "#68757d",
      sky: "#6b9fb4",
      olive: "#7d8755",
      neutral: "#b9bdb8"
    };
    const PALETTE_ORDER = ["red", "blue", "teal", "gold", "violet", "slate", "sky", "olive"];
    const VL_FONT = '"Breve Sans Text", "Breve Sans", Arial, sans-serif';
    const reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let chartInstance = null;
    let resizeObserver = null;

    function isPlainObject(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }

    function finiteNumber(value) {
      return typeof value === "number" && Number.isFinite(value);
    }

    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }

    function cleanString(value, fallback, maxLength) {
      if (typeof value !== "string") return fallback || "";
      return value.slice(0, maxLength || 5000);
    }

    function colorValue(value, fallback) {
      if (typeof value === "string" && Object.prototype.hasOwnProperty.call(PALETTE, value)) {
        return PALETTE[value];
      }
      if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
        return value.toLowerCase();
      }
      return fallback || PALETTE.slate;
    }

    function colorWithAlpha(value, alpha) {
      const hex = colorValue(value, PALETTE.slate).replace("#", "");
      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      const safeAlpha = clamp(finiteNumber(alpha) ? alpha : 0.14, 0, 0.6);
      return "rgba(" + red + "," + green + "," + blue + "," + safeAlpha + ")";
    }

    function contrastTextColor(value) {
      const hex = colorValue(value, PALETTE.slate).replace("#", "");
      const channels = [0, 2, 4].map(function (start) {
        const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      const whiteContrast = 1.05 / (luminance + 0.05);
      const darkLuminance = 0.0331;
      const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
      return darkContrast >= whiteContrast ? "#333333" : "#ffffff";
    }

    function createTextElement(tagName, className, text) {
      const element = document.createElement(tagName);
      if (className) element.className = className;
      element.textContent = text;
      return element;
    }

    function parseConfig() {
      const node = root.querySelector(".vl-chart-config");
      if (!node) throw new Error("Mangler grafkonfigurasjon.");
      const parsed = JSON.parse(node.textContent || "{}");
      if (!isPlainObject(parsed)) throw new Error("Ugyldig grafkonfigurasjon.");
      return parsed;
    }

    function normalizePoint(point) {
      if (!isPlainObject(point) || !finiteNumber(point.x) || !finiteNumber(point.y)) {
        throw new Error("Punktdata må ha numeriske x- og y-verdier.");
      }
      return { x: point.x, y: point.y };
    }

    function normalizeAxis(rawAxis) {
      const axis = isPlainObject(rawAxis) ? rawAxis : {};
      return {
        title: cleanString(axis.title, "", 200),
        begin_at_zero: typeof axis.begin_at_zero === "boolean" ? axis.begin_at_zero : undefined,
        minimum: finiteNumber(axis.minimum) ? axis.minimum : undefined,
        maximum: finiteNumber(axis.maximum) ? axis.maximum : undefined,
        suggested_minimum: finiteNumber(axis.suggested_minimum) ? axis.suggested_minimum : undefined,
        suggested_maximum: finiteNumber(axis.suggested_maximum) ? axis.suggested_maximum : undefined,
        tick_step: finiteNumber(axis.tick_step) && axis.tick_step > 0 ? axis.tick_step : undefined,
        grid: typeof axis.grid === "boolean" ? axis.grid : undefined,
        display: axis.display !== false,
        reverse: Boolean(axis.reverse)
      };
    }

    function normalizeConfig(raw) {
      if (raw.schema_version !== "chart@3") throw new Error("Ugyldig komponentversjon.");

      const chartType = ALLOWED_TYPES.has(raw.chart_type) ? raw.chart_type : "bar";
      const labels = Array.isArray(raw.labels)
        ? raw.labels.slice(0, 100).map(function (label) { return cleanString(label, "", 200); })
        : [];

      if (!Array.isArray(raw.datasets) || raw.datasets.length < 1 || raw.datasets.length > 8) {
        throw new Error("Grafen må ha mellom 1 og 8 dataserier.");
      }

      let totalPoints = 0;
      const datasets = raw.datasets.map(function (rawDataset, datasetIndex) {
        if (!isPlainObject(rawDataset) || !Array.isArray(rawDataset.data)) {
          throw new Error("Ugyldig dataserie.");
        }

        totalPoints += rawDataset.data.length;
        if (totalPoints > 4000) throw new Error("Grafen inneholder for mange datapunkter.");

        let datasetType = chartType;
        if ((chartType === "bar" || chartType === "line") && ALLOWED_DATASET_TYPES.has(rawDataset.type)) {
          datasetType = rawDataset.type;
        }

        const fallbackColor = PALETTE[PALETTE_ORDER[datasetIndex % PALETTE_ORDER.length]];
        const baseColor = colorValue(rawDataset.color, fallbackColor);
        const colors = Array.isArray(rawDataset.colors)
          ? rawDataset.colors.slice(0, rawDataset.data.length).map(function (color) {
              return colorValue(color, baseColor);
            })
          : null;

        let data;
        if (chartType === "scatter") {
          data = rawDataset.data.map(normalizePoint);
        } else {
          data = rawDataset.data.map(function (value) {
            if (value === null) return null;
            if (!finiteNumber(value)) throw new Error("Alle datapunkter må være tall eller null.");
            return value;
          });
        }

        return {
          label: cleanString(rawDataset.label, "Serie " + (datasetIndex + 1), 300),
          type: datasetType,
          data: data,
          color: baseColor,
          colors: colors,
          stack: typeof rawDataset.stack === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(rawDataset.stack)
            ? rawDataset.stack
            : undefined,
          fill: Boolean(rawDataset.fill),
          fill_alpha: finiteNumber(rawDataset.fill_alpha) ? clamp(rawDataset.fill_alpha, 0, 0.6) : 0.14,
          tension: finiteNumber(rawDataset.tension) ? clamp(rawDataset.tension, 0, 0.6) : 0.22,
          border_width: finiteNumber(rawDataset.border_width) ? clamp(rawDataset.border_width, 0, 6) : undefined,
          point_radius: finiteNumber(rawDataset.point_radius) ? clamp(rawDataset.point_radius, 0, 8) : undefined,
          point_style: ALLOWED_POINT_STYLES.has(rawDataset.point_style) ? rawDataset.point_style : "circle",
          border_dash: Array.isArray(rawDataset.border_dash)
            ? rawDataset.border_dash.slice(0, 4).map(function (value) {
                return finiteNumber(value) ? clamp(Math.round(value), 0, 30) : 0;
              })
            : [],
          stepped: Boolean(rawDataset.stepped),
          span_gaps: Boolean(rawDataset.span_gaps),
          hidden: Boolean(rawDataset.hidden),
          order: finiteNumber(rawDataset.order) ? clamp(Math.round(rawDataset.order), -20, 20) : 0
        };
      });

      if (chartType === "doughnut") {
        if (datasets.length !== 1) throw new Error("Smultringdiagram støtter én dataserie.");
        if (!labels.length || labels.length !== datasets[0].data.length) {
          throw new Error("Smultringdiagrammet må ha én etikett per verdi.");
        }
        if (datasets[0].data.some(function (value) { return !finiteNumber(value) || value < 0; })) {
          throw new Error("Smultringdiagrammet kan bare inneholde ikke-negative tall.");
        }
        if (datasets[0].data.reduce(function (sum, value) { return sum + value; }, 0) <= 0) {
          throw new Error("Smultringdiagrammet må ha en positiv sum.");
        }
      } else if (chartType !== "scatter") {
        if (!labels.length) throw new Error("Grafen mangler kategorier.");
        datasets.forEach(function (dataset) {
          if (dataset.data.length !== labels.length) {
            throw new Error("Alle dataserier må ha samme antall verdier som kategorier.");
          }
        });
      }

      const rawFormat = isPlainObject(raw.number_format) ? raw.number_format : {};
      const maximumFractionDigits = finiteNumber(rawFormat.maximum_fraction_digits)
        ? clamp(Math.round(rawFormat.maximum_fraction_digits), 0, 6)
        : 1;
      const minimumFractionDigits = finiteNumber(rawFormat.minimum_fraction_digits)
        ? clamp(Math.round(rawFormat.minimum_fraction_digits), 0, maximumFractionDigits)
        : 0;
      const locale = typeof rawFormat.locale === "string" && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(rawFormat.locale)
        ? rawFormat.locale
        : "nb-NO";
      const axisStyle = ["number", "full", "compact"].includes(rawFormat.axis_style)
        ? rawFormat.axis_style
        : "number";
      const labelStyle = ["auto", "number", "full", "compact"].includes(rawFormat.label_style)
        ? rawFormat.label_style
        : "auto";

      const rawLegend = isPlainObject(raw.legend) ? raw.legend : {};
      const rawLabels = isPlainObject(raw.data_labels) ? raw.data_labels : {};
      const rawAxes = isPlainObject(raw.axes) ? raw.axes : {};
      const rawLayout = isPlainObject(raw.layout) ? raw.layout : {};

      const normalizedAxes = {
        x: normalizeAxis(rawAxes.x),
        y: normalizeAxis(rawAxes.y)
      };
      ["x", "y"].forEach(function (axisId) {
        const axis = normalizedAxes[axisId];
        if (axis.minimum !== undefined && axis.maximum !== undefined && axis.minimum >= axis.maximum) {
          throw new Error("Akseminimum må være lavere enn aksemaksimum.");
        }
        if (axis.suggested_minimum !== undefined && axis.suggested_maximum !== undefined && axis.suggested_minimum >= axis.suggested_maximum) {
          throw new Error("Foreslått akseminimum må være lavere enn foreslått aksemaksimum.");
        }
      });

      const referenceLines = Array.isArray(raw.reference_lines)
        ? raw.reference_lines.slice(0, 4).map(function (line) {
            if (!isPlainObject(line)) return null;
            const validValue = finiteNumber(line.value) || typeof line.value === "string";
            if (!validValue) return null;
            return {
              axis: line.axis === "x" ? "x" : "y",
              value: typeof line.value === "string" ? cleanString(line.value, "", 200) : line.value,
              label: cleanString(line.label, "", 180),
              color: colorValue(line.color, PALETTE.slate),
              width: finiteNumber(line.width) ? clamp(line.width, 1, 4) : 1,
              dashed: line.dashed !== false
            };
          }).filter(Boolean)
        : [];

      const centerText = chartType === "doughnut" && isPlainObject(raw.center_text) && typeof raw.center_text.value === "string"
        ? {
            value: cleanString(raw.center_text.value, "", 40),
            label: cleanString(raw.center_text.label, "", 80)
          }
        : null;

      const source = cleanString(raw.source, "", 1500);
      const accessibilitySummary = cleanString(raw.accessibility_summary, "", 3000);
      if (!source) throw new Error("Grafen mangler kilde.");
      if (!accessibilitySummary) throw new Error("Grafen mangler tilgjengelig oppsummering.");

      return {
        schema_version: "chart@2",
        chart_type: chartType,
        preset: ["auto", "comparison", "trend", "composition", "relationship"].includes(raw.preset)
          ? raw.preset
          : "auto",
        title: cleanString(raw.title, "", 500),
        explainer: cleanString(raw.explainer, "", 1500),
        labels: labels,
        datasets: datasets,
        orientation: ["auto", "vertical", "horizontal"].includes(raw.orientation) ? raw.orientation : "auto",
        stacked: Boolean(raw.stacked),
        number_format: {
          locale: locale,
          minimum_fraction_digits: minimumFractionDigits,
          maximum_fraction_digits: maximumFractionDigits,
          prefix: cleanString(rawFormat.prefix, "", 30),
          suffix: cleanString(rawFormat.suffix, "", 40),
          axis_style: axisStyle,
          label_style: labelStyle
        },
        axes: normalizedAxes,
        legend: {
          display: ["auto", "show", "hide"].includes(rawLegend.display) ? rawLegend.display : "auto"
        },
        data_labels: {
          display: ["auto", "show", "hide"].includes(rawLabels.display) ? rawLabels.display : "auto",
          mode: ["auto", "all", "first", "last"].includes(rawLabels.mode) ? rawLabels.mode : "auto",
          position: ["auto", "inside", "outside"].includes(rawLabels.position) ? rawLabels.position : "auto",
          minimum_absolute_value: finiteNumber(rawLabels.minimum_absolute_value)
            ? Math.max(0, rawLabels.minimum_absolute_value)
            : 0,
          include_series_name: Boolean(rawLabels.include_series_name)
        },
        reference_lines: referenceLines,
        center_text: centerText,
        layout: {
          height: finiteNumber(rawLayout.height) ? clamp(Math.round(rawLayout.height), 260, 800) : undefined
        },
        source: source,
        note: cleanString(raw.note, "", 2000),
        accessibility_summary: accessibilitySummary
      };
    }

    function looksTemporal(labels) {
      if (!labels.length) return false;
      const monthPattern = /^(jan(?:uar)?|feb(?:ruar)?|mars|apr(?:il)?|mai|juni|juli|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)(\s+\d{2,4})?$/i;
      const quarterPattern = /^(q[1-4]|[1-4]\.\s*kvartal)(\s+\d{2,4})?$/i;
      return labels.every(function (label) {
        return /^(?:19|20)\d{2}$/.test(label) || monthPattern.test(label) || quarterPattern.test(label);
      });
    }

    function resolvePreset(config) {
      if (config.preset !== "auto") return config.preset;
      if (config.chart_type === "line") return "trend";
      if (config.chart_type === "doughnut") return "composition";
      if (config.chart_type === "scatter") return "relationship";
      return "comparison";
    }

    function resolveOrientation(config) {
      if (config.chart_type !== "bar") return "x";
      if (config.datasets.some(function (dataset) { return dataset.type === "line"; })) return "x";
      if (config.orientation === "horizontal") return "y";
      if (config.orientation === "vertical") return "x";

      const maximumLength = config.labels.reduce(function (longest, label) {
        return Math.max(longest, label.length);
      }, 0);
      const averageLength = config.labels.length
        ? config.labels.reduce(function (sum, label) { return sum + label.length; }, 0) / config.labels.length
        : 0;
      const hasLongLabels = maximumLength > 13 || averageLength > 9;
      const manyCategories = config.labels.length > 7;
      const rankingLike = config.datasets.length === 1 && config.labels.length >= 4 && !looksTemporal(config.labels);

      return hasLongLabels || manyCategories || rankingLike ? "y" : "x";
    }

    function resolveLegendDisplay(config) {
      if (config.legend.display === "show") return true;
      if (config.legend.display === "hide") return false;
      if (config.chart_type === "doughnut") return true;
      return config.datasets.filter(function (dataset) { return !dataset.hidden; }).length > 1;
    }

    function resolveDataLabelSettings(config) {
      const totalMarks = config.datasets.reduce(function (sum, dataset) { return sum + dataset.data.length; }, 0);
      let display;
      if (config.data_labels.display === "show") {
        display = true;
      } else if (config.data_labels.display === "hide") {
        display = false;
      } else if (config.chart_type === "bar") {
        display = !config.stacked && totalMarks <= 18;
      } else if (config.chart_type === "line") {
        display = config.datasets.length <= 4;
      } else if (config.chart_type === "doughnut") {
        display = config.labels.length <= 6;
      } else {
        display = false;
      }

      let mode = config.data_labels.mode;
      if (mode === "auto") {
        mode = config.chart_type === "line" ? "last" : "all";
      }

      return {
        display: display,
        mode: mode,
        position: config.data_labels.position,
        minimum_absolute_value: config.data_labels.minimum_absolute_value,
        include_series_name: config.data_labels.include_series_name
      };
    }

    function makeNumberFormatters(config) {
      const normal = new Intl.NumberFormat(config.number_format.locale, {
        minimumFractionDigits: config.number_format.minimum_fraction_digits,
        maximumFractionDigits: config.number_format.maximum_fraction_digits
      });
      const compact = new Intl.NumberFormat(config.number_format.locale, {
        notation: "compact",
        maximumFractionDigits: Math.min(1, config.number_format.maximum_fraction_digits)
      });
      return { normal: normal, compact: compact };
    }

    function formatFull(value, config, formatters) {
      if (value === null || value === undefined || !finiteNumber(value)) return "–";
      return config.number_format.prefix + formatters.normal.format(value) + config.number_format.suffix;
    }

    function formatAxis(value, config, formatters) {
      if (!finiteNumber(Number(value))) return String(value);
      const numeric = Number(value);
      if (config.number_format.axis_style === "full") return formatFull(numeric, config, formatters);
      if (config.number_format.axis_style === "compact") {
        return config.number_format.prefix + formatters.compact.format(numeric);
      }
      return formatters.normal.format(numeric);
    }

    function formatLabelValue(value, config, formatters) {
      if (!finiteNumber(value)) return "–";
      let style = config.number_format.label_style;
      if (style === "auto") {
        const affixLength = config.number_format.prefix.length + config.number_format.suffix.length;
        style = config.chart_type === "doughnut" || affixLength <= 3 ? "full" : "number";
      }
      if (style === "full") return formatFull(value, config, formatters);
      if (style === "compact") return config.number_format.prefix + formatters.compact.format(value);
      return formatters.normal.format(value);
    }

    function formatScatterPoint(point, config, formatters) {
      if (!isPlainObject(point)) return "–";
      return "x: " + formatters.normal.format(point.x) + ", y: " + formatFull(point.y, config, formatters);
    }

    function computeHeight(config, orientation, width) {
      if (config.layout.height) return config.layout.height;
      const mobile = width > 0 && width < 520;
      if (config.chart_type === "doughnut") return mobile ? 330 : 370;
      if (config.chart_type === "line" || config.chart_type === "scatter") return mobile ? 350 : 390;
      if (orientation === "y") {
        const rowHeight = config.datasets.length > 1 ? (mobile ? 58 : 54) : (mobile ? 47 : 43);
        return clamp(105 + config.labels.length * rowHeight, 290, 800);
      }
      return config.labels.length > 8 ? (mobile ? 390 : 420) : (mobile ? 345 : 375);
    }

    function renderStaticContent(config, orientation, preset) {
      const title = root.querySelector(".vl-chart-title");
      const explainer = root.querySelector(".vl-chart-explainer");
      const summary = root.querySelector(".vl-chart-summary");
      const source = root.querySelector(".vl-chart-source");
      const note = root.querySelector(".vl-chart-note");
      const canvas = root.querySelector(".vl-chart-canvas");

      title.textContent = config.title;
      title.hidden = !config.title;
      explainer.textContent = config.explainer;
      explainer.hidden = !config.explainer;
      summary.textContent = config.accessibility_summary;
      source.textContent = config.source;
      source.hidden = !config.source;
      note.textContent = config.note;
      note.hidden = !config.note;
      canvas.setAttribute("aria-label", config.accessibility_summary || config.title || "Datavisualisering");

      root.setAttribute("data-vl-chart-radial", config.chart_type === "doughnut" ? "true" : "false");
      root.setAttribute("data-vl-chart-orientation", orientation === "y" ? "horizontal" : "vertical");
      root.setAttribute("data-vl-chart-preset", preset);

      const width = root.getBoundingClientRect().width || 680;
      root.style.setProperty("--vl-chart-height", computeHeight(config, orientation, width) + "px");
    }

    function datasetDisplayColor(dataset, dataIndex) {
      if (Array.isArray(dataset.colors) && dataset.colors.length) {
        return dataset.colors[dataIndex % dataset.colors.length];
      }
      return dataset.color;
    }

    function renderLegend(config, showLegend) {
      const legend = root.querySelector(".vl-chart-legend");
      legend.replaceChildren();
      if (!showLegend) {
        legend.hidden = true;
        return;
      }

      if (config.chart_type === "doughnut") {
        config.labels.forEach(function (label, index) {
          const item = createTextElement("span", "vl-chart-legend-item", "");
          const swatch = document.createElement("span");
          swatch.className = "vl-chart-swatch";
          swatch.style.setProperty("--vl-chart-swatch", datasetDisplayColor(config.datasets[0], index));
          item.appendChild(swatch);
          item.appendChild(document.createTextNode(label));
          legend.appendChild(item);
        });
      } else {
        config.datasets.forEach(function (dataset) {
          if (dataset.hidden) return;
          const item = createTextElement("span", "vl-chart-legend-item", "");
          const swatch = document.createElement("span");
          const lineLike = dataset.type === "line" || config.chart_type === "line" || config.chart_type === "scatter";
          swatch.className = lineLike ? "vl-chart-swatch vl-chart-swatch--line" : "vl-chart-swatch";
          swatch.style.setProperty("--vl-chart-swatch", dataset.color);
          if (lineLike && dataset.border_dash.length) swatch.setAttribute("data-vl-dashed", "true");
          item.appendChild(swatch);
          item.appendChild(document.createTextNode(dataset.label));
          legend.appendChild(item);
        });
      }

      legend.hidden = legend.childElementCount === 0;
    }

    function renderTable(config, formatters) {
      const host = root.querySelector(".vl-chart-table-host");
      host.replaceChildren();

      const table = document.createElement("table");
      table.className = "vl-chart-data-table";
      const caption = document.createElement("caption");
      caption.textContent = config.title ? "Tallgrunnlag: " + config.title : "Tallgrunnlag";
      table.appendChild(caption);

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      if (config.chart_type === "scatter") {
        ["Serie", "X", "Y"].forEach(function (heading) {
          headerRow.appendChild(createTextElement("th", "", heading));
        });
      } else {
        headerRow.appendChild(createTextElement("th", "", "Kategori"));
        config.datasets.forEach(function (dataset) {
          headerRow.appendChild(createTextElement("th", "", dataset.label));
        });
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      if (config.chart_type === "scatter") {
        config.datasets.forEach(function (dataset) {
          dataset.data.forEach(function (point) {
            const row = document.createElement("tr");
            row.appendChild(createTextElement("td", "", dataset.label));
            row.appendChild(createTextElement("td", "", formatters.normal.format(point.x)));
            row.appendChild(createTextElement("td", "", formatFull(point.y, config, formatters)));
            tbody.appendChild(row);
          });
        });
      } else {
        config.labels.forEach(function (label, index) {
          const row = document.createElement("tr");
          row.appendChild(createTextElement("td", "", label));
          config.datasets.forEach(function (dataset) {
            row.appendChild(createTextElement("td", "", formatFull(dataset.data[index], config, formatters)));
          });
          tbody.appendChild(row);
        });
      }
      table.appendChild(tbody);
      host.appendChild(table);
    }

    function revealFallbackTable() {
      const table = root.querySelector(".vl-chart-data-table");
      if (!table) return;
      table.classList.remove("vl-chart-sr-only");
      table.classList.add("vl-chart-data-table--fallback");
    }

    function fail(message) {
      root.setAttribute("data-vl-chart-error", "true");
      const errorNode = root.querySelector(".vl-chart-error");
      if (errorNode) {
        errorNode.textContent = message || "Grafen kunne ikke vises. Tallgrunnlaget vises i stedet.";
      }
      revealFallbackTable();
    }

    function chartMajorVersion() {
      if (!window.Chart || typeof window.Chart.version !== "string") return null;
      const major = parseInt(window.Chart.version.split(".")[0], 10);
      return Number.isFinite(major) ? major : null;
    }

    function loadChartJsOnce() {
      const existingMajor = chartMajorVersion();
      if (existingMajor === 4) return Promise.resolve();
      if (existingMajor !== null && existingMajor !== 4) {
        return Promise.reject(new Error("Inkompatibel Chart.js-versjon."));
      }
      if (window.__vlChartJs4Promise) return window.__vlChartJs4Promise;

      window.__vlChartJs4Promise = new Promise(function (resolve, reject) {
        const existingScript = document.querySelector('script[data-vl-chartjs-major="4"]');
        if (existingScript) {
          if (chartMajorVersion() === 4) {
            resolve();
            return;
          }
          existingScript.addEventListener("load", function () {
            chartMajorVersion() === 4 ? resolve() : reject(new Error("Chart.js 4 ble ikke tilgjengelig."));
          }, { once: true });
          existingScript.addEventListener("error", function () {
            reject(new Error("Chart.js kunne ikke lastes."));
          }, { once: true });
          return;
        }

        const script = document.createElement("script");
        script.src = CHARTJS_URL;
        script.async = true;
        script.referrerPolicy = "no-referrer";
        script.dataset.vlChartjsMajor = "4";
        script.dataset.vlChartjsVersion = "4.5.1";
        script.addEventListener("load", function () {
          chartMajorVersion() === 4 ? resolve() : reject(new Error("Ugyldig Chart.js-versjon."));
        }, { once: true });
        script.addEventListener("error", function () {
          reject(new Error("Chart.js kunne ikke lastes."));
        }, { once: true });
        document.head.appendChild(script);
      });

      return window.__vlChartJs4Promise;
    }

    function wrapLabel(label, maximumCharacters, maximumLines) {
      const lineLimit = maximumLines || 2;
      if (typeof label !== "string" || label.length <= maximumCharacters) return label;
      const words = label.split(/\s+/).filter(Boolean);
      if (words.length < 2) return label;
      const lines = [];
      let current = "";
      words.forEach(function (word) {
        const next = current ? current + " " + word : word;
        if (next.length > maximumCharacters && current) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      });
      if (current) lines.push(current);
      if (lines.length > lineLimit) {
        return lines.slice(0, lineLimit - 1).concat([lines.slice(lineLimit - 1).join(" ")]);
      }
      return lines;
    }

    function applyAxisBounds(scale, axis) {
      if (axis.minimum !== undefined) scale.min = axis.minimum;
      if (axis.maximum !== undefined) scale.max = axis.maximum;
      if (axis.suggested_minimum !== undefined) scale.suggestedMin = axis.suggested_minimum;
      if (axis.suggested_maximum !== undefined) scale.suggestedMax = axis.suggested_maximum;
      if (axis.tick_step !== undefined) scale.ticks.stepSize = axis.tick_step;
    }

    function buildScales(config, orientation, labelSettings, formatters) {
      const scales = {};
      const isScatter = config.chart_type === "scatter";
      const horizontalBar = config.chart_type === "bar" && orientation === "y";

      ["x", "y"].forEach(function (axisId) {
        const axis = config.axes[axisId];
        const categoryAxis = !isScatter && ((horizontalBar && axisId === "y") || (!horizontalBar && axisId === "x"));
        const valueAxis = !categoryAxis;
        const defaultBeginAtZero = config.chart_type === "bar" && valueAxis;
        const defaultGrid = valueAxis || isScatter;
        const scale = {
          type: categoryAxis ? "category" : "linear",
          position: axisId === "x" ? "bottom" : "left",
          display: axis.display,
          beginAtZero: axis.begin_at_zero !== undefined ? axis.begin_at_zero : defaultBeginAtZero,
          stacked: config.stacked,
          reverse: axis.reverse,
          border: { display: false },
          grid: {
            display: axis.grid !== undefined ? axis.grid : defaultGrid,
            color: "rgba(51, 51, 51, 0.10)",
            drawTicks: false
          },
          title: {
            display: Boolean(axis.title),
            text: axis.title,
            color: "#333333",
            padding: { top: 8, bottom: 2 },
            font: { family: VL_FONT, size: 13, weight: "700" }
          },
          ticks: {
            color: categoryAxis ? "#333333" : "#686864",
            padding: categoryAxis ? 9 : 8,
            maxRotation: 0,
            minRotation: 0,
            font: { family: VL_FONT, size: categoryAxis ? 13 : 12, weight: "400" }
          }
        };

        if (categoryAxis) {
          scale.grid.display = false;
          scale.ticks.autoSkip = !horizontalBar;
          scale.ticks.maxTicksLimit = horizontalBar ? undefined : 12;
          if (horizontalBar) {
            scale.ticks.callback = function (_value, index) {
              const width = root.getBoundingClientRect().width || 680;
              const perLine = Math.max(12, Math.min(28, Math.round(width / 24)));
              return wrapLabel(config.labels[index] || "", perLine, 3);
            };
          } else {
            scale.ticks.callback = function (_value, index) {
              return wrapLabel(config.labels[index] || "", 12);
            };
          }
        } else {
          scale.ticks.callback = function (value) {
            return formatAxis(Number(value), config, formatters);
          };
          if (labelSettings.display && config.chart_type === "bar") scale.grace = "12%";
          if (config.chart_type === "line") scale.grace = "7%";
        }

        applyAxisBounds(scale, axis);
        scales[axisId] = scale;
      });

      return scales;
    }

    function buildDatasets(config, orientation) {
      return config.datasets.map(function (dataset) {
        const datasetType = config.chart_type === "scatter" || config.chart_type === "doughnut"
          ? config.chart_type
          : dataset.type;
        const chartDataset = {
          label: dataset.label,
          type: datasetType,
          data: dataset.data,
          hidden: dataset.hidden,
          order: dataset.order,
          stack: dataset.stack,
          clip: false
        };

        if (datasetType === "doughnut") {
          const colors = dataset.colors && dataset.colors.length
            ? dataset.colors
            : config.labels.map(function (_label, index) {
                return PALETTE[PALETTE_ORDER[index % PALETTE_ORDER.length]];
              });
          chartDataset.backgroundColor = colors;
          chartDataset.hoverBackgroundColor = colors;
          chartDataset.borderColor = "#ffffff";
          chartDataset.borderWidth = 2;
          chartDataset.hoverOffset = 3;
          chartDataset.spacing = 1;
          return chartDataset;
        }

        if (datasetType === "line") {
          const defaultRadius = config.labels.length > 14 ? 0 : 3;
          chartDataset.borderColor = dataset.color;
          chartDataset.backgroundColor = dataset.fill ? colorWithAlpha(dataset.color, dataset.fill_alpha) : dataset.color;
          chartDataset.borderWidth = dataset.border_width !== undefined ? dataset.border_width : 3;
          chartDataset.borderDash = dataset.border_dash;
          chartDataset.pointBackgroundColor = dataset.color;
          chartDataset.pointBorderColor = "#ffffff";
          chartDataset.pointBorderWidth = 2;
          chartDataset.pointRadius = dataset.point_radius !== undefined ? dataset.point_radius : defaultRadius;
          chartDataset.pointHoverRadius = Math.max(4, (dataset.point_radius !== undefined ? dataset.point_radius : defaultRadius) + 2);
          chartDataset.pointStyle = dataset.point_style;
          chartDataset.tension = dataset.tension;
          chartDataset.fill = dataset.fill;
          chartDataset.stepped = dataset.stepped;
          chartDataset.spanGaps = dataset.span_gaps;
          return chartDataset;
        }

        if (datasetType === "scatter") {
          chartDataset.backgroundColor = dataset.color;
          chartDataset.borderColor = "#ffffff";
          chartDataset.borderWidth = 1.5;
          chartDataset.pointRadius = dataset.point_radius !== undefined ? dataset.point_radius : 5;
          chartDataset.pointHoverRadius = Math.max(6, (dataset.point_radius !== undefined ? dataset.point_radius : 5) + 2);
          chartDataset.pointStyle = dataset.point_style;
          chartDataset.showLine = false;
          return chartDataset;
        }

        chartDataset.backgroundColor = dataset.colors && dataset.colors.length ? dataset.colors : dataset.color;
        chartDataset.hoverBackgroundColor = dataset.colors && dataset.colors.length ? dataset.colors : dataset.color;
        chartDataset.borderColor = dataset.color;
        chartDataset.borderWidth = dataset.border_width !== undefined ? dataset.border_width : 0;
        chartDataset.borderSkipped = false;
        chartDataset.borderRadius = 3;
        chartDataset.maxBarThickness = orientation === "y"
          ? (config.datasets.length > 1 ? 22 : 30)
          : (config.datasets.length > 1 ? 34 : 46);
        chartDataset.barPercentage = orientation === "y" ? 0.74 : 0.82;
        chartDataset.categoryPercentage = orientation === "y" ? 0.78 : 0.72;
        return chartDataset;
      });
    }

    function shouldIncludeDataIndex(mode, dataIndex, data) {
      if (mode === "all") return true;
      if (mode === "first") {
        return data.findIndex(function (value) { return value !== null; }) === dataIndex;
      }
      if (mode === "last") {
        for (let index = data.length - 1; index >= 0; index -= 1) {
          if (data[index] !== null) return index === dataIndex;
        }
        return false;
      }
      return true;
    }

    function datasetCanvasColor(dataset, index) {
      const background = dataset.backgroundColor;
      if (Array.isArray(background)) return background[index % background.length];
      return background || dataset.borderColor || PALETTE.slate;
    }

    function createValueLabelsPlugin(config, orientation, settings, formatters) {
      return {
        id: "vlChartValueLabelsV2",
        afterDatasetsDraw: function (chart) {
          if (!settings.display) return;
          const ctx = chart.ctx;
          const area = chart.chartArea;
          const lineCandidates = [];
          ctx.save();
          ctx.font = "700 13px " + VL_FONT;

          chart.data.datasets.forEach(function (dataset, datasetIndex) {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (meta.hidden) return;
            const datasetType = dataset.type || config.chart_type;

            if (datasetType === "line") {
              meta.data.forEach(function (element, dataIndex) {
                const raw = dataset.data[dataIndex];
                if (!finiteNumber(raw)) return;
                if (Math.abs(raw) < settings.minimum_absolute_value) return;
                if (!shouldIncludeDataIndex(settings.mode, dataIndex, dataset.data)) return;
                const valueText = formatLabelValue(raw, config, formatters);
                const text = settings.include_series_name ? dataset.label + ": " + valueText : valueText;
                lineCandidates.push({
                  x: element.x,
                  desiredY: element.y,
                  y: element.y,
                  text: text,
                  color: dataset.borderColor || dataset.backgroundColor || PALETTE.slate
                });
              });
              return;
            }

            meta.data.forEach(function (element, dataIndex) {
              const raw = dataset.data[dataIndex];
              const numeric = finiteNumber(raw) ? raw : (isPlainObject(raw) && finiteNumber(raw.y) ? raw.y : null);
              if (numeric === null || Math.abs(numeric) < settings.minimum_absolute_value) return;
              if (!shouldIncludeDataIndex(settings.mode, dataIndex, dataset.data)) return;

              const valueText = formatLabelValue(numeric, config, formatters);
              const text = settings.include_series_name ? dataset.label + ": " + valueText : valueText;
              const textWidth = ctx.measureText(text).width;
              const fillColor = datasetCanvasColor(dataset, dataIndex);

              if (datasetType === "doughnut" && element.startAngle !== undefined) {
                const angle = element.endAngle - element.startAngle;
                const radius = element.innerRadius + (element.outerRadius - element.innerRadius) * 0.58;
                const availableArc = Math.abs(angle * radius);
                const availableThickness = element.outerRadius - element.innerRadius;
                if (availableArc < textWidth + 10 || availableThickness < 22) return;
                const middleAngle = (element.startAngle + element.endAngle) / 2;
                const x = element.x + Math.cos(middleAngle) * radius;
                const y = element.y + Math.sin(middleAngle) * radius;
                ctx.fillStyle = contrastTextColor(fillColor);
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(text, x, y);
                return;
              }

              if (datasetType === "scatter") {
                ctx.fillStyle = "#333333";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillText(text, element.x, element.y - 8);
                return;
              }

              const positive = numeric >= 0;
              if (orientation === "y") {
                const barLength = Math.abs(element.x - element.base);
                const canFitInside = barLength >= textWidth + 18 && element.height >= 18;
                const placeInside = settings.position === "inside"
                  ? canFitInside
                  : settings.position === "outside"
                    ? false
                    : canFitInside;
                let x;
                if (placeInside) {
                  x = positive ? element.x - 8 : element.x + 8;
                  ctx.textAlign = positive ? "right" : "left";
                  ctx.fillStyle = contrastTextColor(fillColor);
                } else {
                  x = positive ? element.x + 7 : element.x - 7;
                  ctx.textAlign = positive ? "left" : "right";
                  ctx.fillStyle = "#333333";
                }
                if (ctx.textAlign === "left") {
                  x = clamp(x, 3, Math.max(3, chart.width - textWidth - 3));
                } else {
                  x = clamp(x, textWidth + 3, chart.width - 3);
                }
                ctx.textBaseline = "middle";
                ctx.fillText(text, x, element.y);
                return;
              }

              const barHeight = Math.abs(element.base - element.y);
              const canFitInside = barHeight >= 28 && element.width >= textWidth + 10;
              const placeInside = settings.position === "inside"
                ? canFitInside
                : settings.position === "outside"
                  ? false
                  : canFitInside;
              ctx.textAlign = "center";
              if (placeInside) {
                ctx.fillStyle = contrastTextColor(fillColor);
                ctx.textBaseline = "middle";
                ctx.fillText(text, element.x, positive ? element.y + 14 : element.y - 14);
              } else if (!config.stacked || settings.position === "outside") {
                ctx.fillStyle = "#333333";
                ctx.textBaseline = positive ? "bottom" : "top";
                const y = positive ? element.y - 7 : element.y + 7;
                ctx.fillText(text, element.x, clamp(y, area.top + 2, area.bottom - 2));
              }
            });
          });

          if (lineCandidates.length) {
            lineCandidates.sort(function (a, b) { return a.desiredY - b.desiredY; });
            const minimumGap = 18;
            const top = area.top + 8;
            const bottom = area.bottom - 8;
            lineCandidates.forEach(function (candidate, index) {
              candidate.y = index === 0
                ? Math.max(top, candidate.desiredY)
                : Math.max(candidate.desiredY, lineCandidates[index - 1].y + minimumGap);
            });
            if (lineCandidates[lineCandidates.length - 1].y > bottom) {
              lineCandidates[lineCandidates.length - 1].y = bottom;
              for (let index = lineCandidates.length - 2; index >= 0; index -= 1) {
                lineCandidates[index].y = Math.min(lineCandidates[index].y, lineCandidates[index + 1].y - minimumGap);
              }
            }

            lineCandidates.forEach(function (candidate) {
              const textWidth = ctx.measureText(candidate.text).width;
              let x = candidate.x + 9;
              let align = "left";
              if (x + textWidth > chart.width - 3) {
                x = candidate.x - 9;
                align = "right";
              }
              if (Math.abs(candidate.y - candidate.desiredY) > 2) {
                ctx.strokeStyle = candidate.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(candidate.x + (align === "left" ? 3 : -3), candidate.desiredY);
                ctx.lineTo(x + (align === "left" ? -3 : 3), candidate.y);
                ctx.stroke();
              }
              ctx.textAlign = align;
              ctx.textBaseline = "middle";
              ctx.lineWidth = 4;
              ctx.lineJoin = "round";
              ctx.strokeStyle = "rgba(255,255,255,0.96)";
              ctx.strokeText(candidate.text, x, candidate.y);
              ctx.fillStyle = candidate.color;
              ctx.fillText(candidate.text, x, candidate.y);
            });
          }

          ctx.restore();
        }
      };
    }

    function createCenterTextPlugin(config) {
      return {
        id: "vlChartCenterTextV2",
        afterDatasetsDraw: function (chart) {
          if (!config.center_text || config.chart_type !== "doughnut") return;
          const meta = chart.getDatasetMeta(0);
          if (!meta || !meta.data || !meta.data.length) return;
          const first = meta.data[0];
          const width = chart.chartArea.right - chart.chartArea.left;
          const ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#333333";
          ctx.font = "700 " + (width < 285 ? 28 : 34) + "px " + VL_FONT;
          ctx.fillText(config.center_text.value, first.x, first.y - (config.center_text.label ? 8 : 0));
          if (config.center_text.label) {
            ctx.fillStyle = "#686864";
            ctx.font = "400 " + (width < 285 ? 12 : 13) + "px " + VL_FONT;
            ctx.fillText(config.center_text.label, first.x, first.y + 20);
          }
          ctx.restore();
        }
      };
    }

    function createReferenceLinesPlugin(config) {
      return {
        id: "vlChartReferenceLinesV2",
        beforeDatasetsDraw: function (chart) {
          if (!config.reference_lines.length) return;
          const ctx = chart.ctx;
          const area = chart.chartArea;
          ctx.save();

          config.reference_lines.forEach(function (line) {
            const scale = chart.scales[line.axis];
            if (!scale) return;
            const pixel = scale.getPixelForValue(line.value);
            if (!finiteNumber(pixel)) return;

            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.width;
            ctx.setLineDash(line.dashed ? [5, 5] : []);
            ctx.beginPath();
            if (line.axis === "x") {
              ctx.moveTo(pixel, area.top);
              ctx.lineTo(pixel, area.bottom);
            } else {
              ctx.moveTo(area.left, pixel);
              ctx.lineTo(area.right, pixel);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            if (!line.label) return;
            ctx.font = "700 12px " + VL_FONT;
            const metrics = ctx.measureText(line.label);
            const paddingX = 5;
            const boxWidth = metrics.width + paddingX * 2;
            const boxHeight = 21;
            let x;
            let y;
            if (line.axis === "x") {
              x = clamp(pixel + 6, area.left + 2, area.right - boxWidth - 2);
              y = area.top + 5;
            } else {
              x = area.right - boxWidth - 2;
              y = pixel - boxHeight - 5;
              if (y < area.top + 2) y = pixel + 5;
              y = clamp(y, area.top + 2, area.bottom - boxHeight - 2);
            }
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.fillRect(x, y, boxWidth, boxHeight);
            ctx.fillStyle = line.color;
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(line.label, x + paddingX, y + 15);
          });

          ctx.restore();
        }
      };
    }

    function tooltipLabel(context, config, formatters) {
      if (config.chart_type === "scatter") {
        return context.dataset.label + ": " + formatScatterPoint(context.raw, config, formatters);
      }
      if (config.chart_type === "doughnut") {
        const category = config.labels[context.dataIndex] || "";
        return category + ": " + formatFull(context.raw, config, formatters);
      }
      const label = context.dataset.label ? context.dataset.label + ": " : "";
      return label + formatFull(context.raw, config, formatters);
    }

    function createChartOptions(config, orientation, labelSettings, formatters) {
      const radial = config.chart_type === "doughnut";
      const scatter = config.chart_type === "scatter";
      const hasNegativeBars = config.chart_type === "bar" && config.datasets.some(function (dataset) {
        return dataset.data.some(function (value) { return finiteNumber(value) && value < 0; });
      });

      let layoutPadding;
      if (radial) {
        layoutPadding = 5;
      } else if (config.chart_type === "line") {
        layoutPadding = { top: 18, right: labelSettings.display ? 66 : 12, bottom: 0, left: 2 };
      } else if (config.chart_type === "bar" && orientation === "y") {
        layoutPadding = { top: 5, right: labelSettings.display ? 54 : 8, bottom: 0, left: hasNegativeBars && labelSettings.display ? 48 : 2 };
      } else if (config.chart_type === "bar") {
        layoutPadding = { top: labelSettings.display ? 30 : 12, right: 8, bottom: 0, left: 2 };
      } else {
        layoutPadding = 8;
      }

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: orientation,
        interaction: {
          mode: scatter || radial ? "nearest" : "index",
          intersect: scatter || radial,
          axis: scatter || radial ? "xy" : orientation
        },
        animation: reducedMotion ? false : { duration: 650, easing: "easeOutQuart" },
        layout: { padding: layoutPadding },
        plugins: {
          legend: { display: false },
          tooltip: {
            position: "nearest",
            animation: false,
            backgroundColor: "rgba(33, 33, 33, 0.96)",
            titleColor: "#ffffff",
            bodyColor: "#ffffff",
            displayColors: config.datasets.length > 1 || radial,
            padding: 11,
            cornerRadius: 3,
            titleFont: { family: VL_FONT, size: 14, weight: "700" },
            bodyFont: { family: VL_FONT, size: 13, weight: "400" },
            callbacks: {
              label: function (context) {
                return tooltipLabel(context, config, formatters);
              }
            }
          }
        }
      };

      if (!radial) options.scales = buildScales(config, orientation, labelSettings, formatters);
      if (radial) {
        options.cutout = "62%";
        options.rotation = -90;
      }
      return options;
    }

    function initChart(config, orientation, labelSettings, formatters) {
      const canvas = root.querySelector(".vl-chart-canvas");
      if (!canvas || !window.Chart) throw new Error("Chart.js er ikke tilgjengelig.");
      const existing = window.Chart.getChart(canvas);
      if (existing) existing.destroy();

      chartInstance = new window.Chart(canvas.getContext("2d"), {
        type: config.chart_type,
        data: {
          labels: config.labels,
          datasets: buildDatasets(config, orientation)
        },
        plugins: [
          createReferenceLinesPlugin(config),
          createValueLabelsPlugin(config, orientation, labelSettings, formatters),
          createCenterTextPlugin(config)
        ],
        options: createChartOptions(config, orientation, labelSettings, formatters)
      });
    }

    function observeSize(config, orientation) {
      if (!window.ResizeObserver) return;
      let previousHeight = 0;
      resizeObserver = new ResizeObserver(function (entries) {
        if (!root.isConnected) {
          resizeObserver.disconnect();
          resizeObserver = null;
          return;
        }
        if (!entries.length) return;
        const width = entries[0].contentRect.width;
        const height = computeHeight(config, orientation, width);
        if (height === previousHeight) return;
        previousHeight = height;
        root.style.setProperty("--vl-chart-height", height + "px");
        if (chartInstance) chartInstance.resize();
      });
      resizeObserver.observe(root);
    }

    let config;
    let orientation;
    let formatters;
    let labelSettings;
    try {
      config = normalizeConfig(parseConfig());
      orientation = resolveOrientation(config);
      formatters = makeNumberFormatters(config);
      labelSettings = resolveDataLabelSettings(config);
      renderStaticContent(config, orientation, resolvePreset(config));
      renderLegend(config, resolveLegendDisplay(config));
      renderTable(config, formatters);
      observeSize(config, orientation);
    } catch (_error) {
      fail("Grafdataene kunne ikke valideres. Kontroller tallgrunnlaget og prøv igjen.");
      return;
    }

    loadChartJsOnce()
      .then(function () {
        if (document.fonts && document.fonts.load) {
          return document.fonts.load('16px "Breve Sans Text"');
        }
        if (document.fonts && document.fonts.ready) return document.fonts.ready;
        return undefined;
      })
      .then(function () {
        root.setAttribute("data-vl-chart-enhanced", "true");
        initChart(config, orientation, labelSettings, formatters);
      })
      .catch(function () {
        fail("Grafen kunne ikke tegnes. Tallgrunnlaget vises i stedet.");
      });
  }

  function scan() {
    var roots = document.querySelectorAll(".vl-chart-embed-v3:not([data-vl-chart-init])");
    Array.prototype.forEach.call(roots, function (root) {
      root.setAttribute("data-vl-chart-init", "true");
      try {
        initRoot(root);
      } catch (_error) {
        root.setAttribute("data-vl-chart-error", "true");
      }
    });
  }

  window[GLOBAL_KEY] = { version: "2.0.3", scan: scan };
  scan();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan, { once: true });
  }
  if ("MutationObserver" in window) {
    var pending = 0;
    new MutationObserver(function () {
      if (pending) return;
      pending = window.setTimeout(function () {
        pending = 0;
        scan();
      }, 60);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
