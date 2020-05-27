/**
 * Implementation of the practicon_ui user interface plugin. For overall details
 * of the UI plugin architecture, see userinterfacewrapper.js.
 *
 * This plugin replaces the usual textarea answer element with a div
 * containing the author-supplied interface elements. Their serialisation
 * which is what is essentially copied back into the textarea for submissions
 * as the answer, is a JSON object. The fields of that object are the names
 * of all author-supplied HTML elements with a class 'coderunner-ui-element';
 * all such objects are expected to have a 'name' attribute as well. The
 * associated field values are lists. Each list contains all the values, in
 * document order, of the results of calling the jquery val() method in turn
 * on each of the UI elements with that name.
 * This means that at least input, select and textarea
 * elements are supported. The author is responsible for checking the
 * compatibility of other elements with jquery's val() method.
 *
 * The HTML to use in the answer area must be provided as the contents of
 * the globalextra field in the question authoring form.
 *
 * If any fields of the answer html are to be preloaded, these should be specified
 * in the answer preload with json of the form '{"<fieldName>": "<fieldValueList>",...}'
 * where fieldValueList is a list of all the values to be assigned to the fields
 * with the given name, in document order.
 *
 * To accommodate the possibility of dynamic HTML, any leftover preload values,
 * that is, values that cannot be positioned within the HTML either because
 * there is no field of the required name or because, in the case of a list,
 * there are insufficient elements, are assigned to the data['leftovers']
 * attribute of the outer html div, as a sub-object of the original object.
 * This outer div can be located as the 'closest' (in a jQuery sense)
 * div.qtype-coderunner-html-outer-div. The author-supplied HTML must include
 * JavaScript to make use of the 'leftovers'.
 *
 * As a special case of the serialisation, if all values in the serialisation
 * are either empty strings or a list of empty strings, the serialisation is
 * itself the empty string.
 *
 * @package    qtype
 * @subpackage coderunner
 * @copyright  Richard Lobb, 2018, The University of Canterbury + Rene
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(["jquery", "qtype_coderunner/ui_ace"], function ($, ui_ace) {

    // if this works, we are in question editing mode
    var textArea = document.getElementById("id_answer");
    if (textArea !== null) {
        return ui_ace;
    }

    function PracticonUi(textareaId, width, height, templateParams) {
        this.textArea = $(document.getElementById(textareaId));
        this.readOnly = this.textArea.prop("readonly");
        this.fail = false;
        this.templateParams = templateParams;
        var i = 0, ifspec;

        this.elements = [];
        while (this.textArea.attr("extra-test" + i) !== undefined) {
            try {
                ifspec = JSON.parse(this.textArea.attr("extra-test" + i));
                if (ifspec !== null) {
                    this.elements.push(ifspec);
                }
            } catch (err) {
                alert("Practicon UI, field definition " + (i+1) +
                      " is defective");
            }
            i++;
        }
        this.practiconDiv = null;
        this.reload();
    }

    PracticonUi.prototype.failed = function () {
        return this.fail;
    };

    PracticonUi.prototype.sync = function () {
        var serialisation = {};

        this.getFields().forEach(function (elt) {
            var value,
                type = elt.attr("type"),
                name = elt.attr("name");
            if (type === "checkbox") {
                value = elt.is(":checked");
            } else {
                value = elt.val();
            }
            if (serialisation.hasOwnProperty(name)) {
                alert("duplicate name '" + name + "' in interface");
            }
            serialisation[name] = value;
        });
        this.textArea.val(JSON.stringify(serialisation));
    };

    PracticonUi.prototype.getElement = function () {
        return this.practiconDiv;
    };

    PracticonUi.prototype.getFields = function () {
        return $(this.practiconDiv).find(".coderunner-ui-element");
    };

    PracticonUi.prototype.setField = function (field, value) {
        if (field.attr("type") === "checkbox") {
            field.prop("checked", field.val() === value);
        } else {
            field.val(value);
        }
    };

    PracticonUi.prototype.reload = function () {
        var content = $(this.textArea).val(),
            valuesToLoad = {},
            foundVariables = {},
            html = "<div style='height:fit-content' class='qtype-coderunner-html-outer-div fcontainer clearfix'>",
            printField = function (elt, values, fieldno) {
                var name = elt.name,
                    type = elt.type,
                    label = elt.label,
                    value = values[name],
                    htm;
                if (!type) {
                    type = "text";
                }
                if (!label) {
                    label = "variable '" + name + "'";
                }
                if (!name) {
                    alert("Practicon UI: name missing at " + fieldno);
                }
                if (foundVariables[name]) {
                    alert("Practicon UI: variable '" + name + "' multiple use");
                }
                if (!value) { value = ""; }
                htm = "<div class='form-group row fitem'><div class='col-md-3'>" +
                    "<label class='col-form-label d-inline p-2'>" + label +
                    "</label></div><div class='col-md-9 form-inline felement edit_code p-2' data-fieltype='" + type + "'>";
                if (type === "text") {
                    htm += "<input type='text' class='coderunner-ui-element mform form-inline form-control p-2' name='" +
                        name + "' id='" + name + "' value='" + value + "' size='80'/>";
                } else if (type === "checkbox") {
                    htm += "<input type='checkbox' class='coderunner-ui-element form-check-input' name='" +
                        name + "' id='" + name + "' checked='" + value + "'/>";
                } else if (type === "textarea") {
                    htm += "<textarea class='coderunner-ui-element mform form-control d-block pr-2 pl-2' name='" +
                        name + "' id='" + name +
                        "' rows='4'>" + value + "</textarea>";
                }
                htm += "</div></div>";
                return htm;
            };

        if (content) {
            try {
                valuesToLoad = JSON.parse(content);
            } catch (e) {
                alert("No values to load");
            }
        }

        this.elements.forEach(function (elt, index) {
            html += "<div class='fcontainer clearfix'>";
            if (Array.isArray(elt)) {
                // run through all fields
                elt.forEach(function (sub) {
                    html += printField(sub, valuesToLoad, index);
                });
            } else {
                html += printField(elt, valuesToLoad, index);
            }
            html += "</div>";
        });
        html += "</div>";
        this.practiconDiv = $(html);
    };

    PracticonUi.prototype.resize = function () { };

    PracticonUi.prototype.hasFocus = function () {
        var focused = false;
        this.getFields().each(function () {
            if (this === document.activeElement) {
                focused = true;
            }
        });
        return focused;
    };

    PracticonUi.prototype.destroy = function () {
        this.sync();
        $(this.practiconDiv).remove();
        this.practiconDiv = null;
    };

    return {
        Constructor: PracticonUi
    };
});
