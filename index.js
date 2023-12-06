    class Query {
        static TYPE_EQUAL = 'equal';
        static TYPE_NOT_EQUAL = 'notEqual';
        static TYPE_LESSER = 'lessThan';
        static TYPE_LESSER_EQUAL = 'lessThanEqual';
        static TYPE_GREATER = 'greaterThan';
        static TYPE_GREATER_EQUAL = 'greaterThanEqual';
        static TYPE_CONTAINS = 'contains';
        static TYPE_SEARCH = 'search';
        static TYPE_IS_NULL = 'isNull';
        static TYPE_IS_NOT_NULL = 'isNotNull';
        static TYPE_BETWEEN = 'between';
        static TYPE_STARTS_WITH = 'startsWith';
        static TYPE_ENDS_WITH = 'endsWith';

        static TYPE_SELECT = 'select';

        static TYPE_ORDER_DESC = 'orderDesc';
        static TYPE_ORDER_ASC = 'orderAsc';

        static TYPE_LIMIT = 'limit';
        static TYPE_OFFSET = 'offset';
        static TYPE_CURSOR_AFTER = 'cursorAfter';
        static TYPE_CURSOR_BEFORE = 'cursorBefore';

        static CHAR_PARENTHESES_START = '(';
        static CHAR_BACKSLASH = '\\';
        static CHAR_BRACKET_START = '[';
        static CHAR_BRACKET_END = ']';
        static CHAR_COMMA = ',';
        static CHAR_SPACE = ' ';
        static CHAR_SINGLE_QUOTE = '\'';
        static CHAR_DOUBLE_QUOTE = '"';

        // Add other static methods as needed, such as isSpecialChar, isQuote, appendSymbol, parseValue, getMethodFromAlias...

        static parse(filter) {
            let method = '';
            let params = [];

            let paramsStart = filter.indexOf(Query.CHAR_PARENTHESES_START);

            if (paramsStart === -1) {
                throw new Error('Invalid query');
            }

            method = filter.substring(0, paramsStart);

            let paramsEnd = filter.length - 1; // -1 to ignore )
            let parametersStart = paramsStart + 1; // +1 to ignore (

            if (method.includes('.')) {
                throw new Error('Invalid query method');
            }

            let currentParam = "";
            let currentArrayParam = [];
            let stack = [];
            let stringStackState = null;

            for (let i = parametersStart; i < paramsEnd; i++) {
                let char = filter[i];

                let isStringStack = stringStackState !== null;
                let isArrayStack = !isStringStack && stack.length > 0;

                if (char === Query.CHAR_BACKSLASH) {
                    if (!Query.isSpecialChar(filter[i + 1])) {
                        currentParam = Query.appendSymbol(isStringStack, filter[i], i, filter, currentParam);
                    }

                    currentParam = Query.appendSymbol(isStringStack, filter[i + 1], i, filter, currentParam);
                    i++;
                    continue;
                }

                if (Query.isQuote(char) &&
                    (filter[i - 1] !== Query.CHAR_BACKSLASH || filter[i - 2] === Query.CHAR_BACKSLASH)) {

                    if (isStringStack) {
                        if (char === stringStackState) {
                            stringStackState = null;
                        }
                        currentParam = Query.appendSymbol(isStringStack, char, i, filter, currentParam);
                    } else {
                        stringStackState = char;
                        currentParam = Query.appendSymbol(isStringStack, char, i, filter, currentParam);
                    }
                    continue;
                }

                if (!isStringStack) {
                    if (char === Query.CHAR_BRACKET_START) {
                        stack.push(char);
                        continue;
                    } else if (char === Query.CHAR_BRACKET_END) {
                        stack.pop();

                        if (currentParam.length) {
                            currentArrayParam.push(currentParam);
                        }

                        params.push(currentArrayParam);
                        currentArrayParam = [];
                        currentParam = "";
                        continue;
                    } else if (char === Query.CHAR_COMMA) {
                        if (isArrayStack) {
                            currentArrayParam.push(currentParam);
                            currentParam = "";
                        } else {
                            if (!currentArrayParam.length && currentParam.length) {
                                params.push(currentParam);
                            }
                            currentParam = "";
                        }
                        continue;
                    }
                }

                currentParam = Query.appendSymbol(isStringStack, char, i, filter, currentParam);
            }

            if (currentParam.length) {
                params.push(currentParam);
            }

            let parsedParams = [];

            for (let param of params) {
                if (Array.isArray(param)) {
                    let parsedArray = param.map(element => Query.parseValue(element));
                    parsedParams.push(parsedArray);
                } else {
                    parsedParams.push(Query.parseValue(param));
                }
            }

            switch (method) {
                case Query.TYPE_EQUAL:
                case Query.TYPE_NOT_EQUAL:
                    let attribute = parsedParams[0] ?? '';
                    if (parsedParams.length < 2) {
                        return { method, attribute };
                    }
                    return {
                        method,
                        attribute,
                        values: Array.isArray(parsedParams[1]) ? parsedParams[1] : [parsedParams[1]]
                    };

                case Query.TYPE_LESSER:
                case Query.TYPE_LESSER_EQUAL:
                case Query.TYPE_GREATER:
                case Query.TYPE_GREATER_EQUAL:
                    // Assuming these methods require an attribute and a comparison value
                    return {
                        method,
                        attribute: parsedParams[0],
                        values: [parsedParams[1]]
                    };

                case Query.TYPE_CONTAINS:
                case Query.TYPE_SEARCH:
                    // These might be similar to 'EQUAL' but with different logic
                    return {
                        method,
                        attribute: parsedParams[0],
                        values: [parsedParams[1]]
                    };

                case Query.TYPE_IS_NULL:
                case Query.TYPE_IS_NOT_NULL:
                    // These might only require an attribute
                    return {
                        method,
                        attribute: parsedParams[0],
                        values: []
                    };

                case Query.TYPE_STARTS_WITH:
                case Query.TYPE_ENDS_WITH:
                    // These would likely require an attribute and a string to check against
                    return {
                        method,
                        attribute: parsedParams[0],
                        values: [parsedParams[1]]
                    };

                case Query.TYPE_BETWEEN:
                    // Assuming this requires an attribute and two values to define the range
                    return {
                        method,
                        attribute: parsedParams[0],
                        values: [parsedParams[1], parsedParams[2]]
                    };

                case Query.TYPE_SELECT:
                    // Might be used for selecting specific fields
                    return {
                        method,
                        attribute: null,
                        values: parsedParams
                    };

                case Query.TYPE_ORDER_ASC:
                case Query.TYPE_ORDER_DESC:
                    // Used for ordering by a specific attribute
                    return {
                        method,
                        attribute: parsedParams[0],
                        values: []
                    };

                case Query.TYPE_LIMIT:
                case Query.TYPE_OFFSET:
                case Query.TYPE_CURSOR_AFTER:
                case Query.TYPE_CURSOR_BEFORE:
                    // These could be for pagination or cursor-based navigation
                    return {
                        method,
                        attribute: null,
                        values: [parsedParams[0]]
                    };

                default:
                    return { method, params: parsedParams };
            }
        }

        static parseValue(value) {
            value = value.trim();

            if (value === 'false') {
                return false;
            } else if (value === 'true') {
                return true;
            } else if (value === 'null') {
                return null;
            } else if (!isNaN(value) && value !== '') {
                return Number(value);
            } else if (
                value.startsWith(Query.CHAR_DOUBLE_QUOTE) ||
                value.startsWith(Query.CHAR_SINGLE_QUOTE)
            ) {
                return value.slice(1, -1); // Remove quotes
            }

            return value;
        }

        static appendSymbol(isStringStack, char, index, filter, currentParam) {
            let canBeIgnored = false;

            if (char === Query.CHAR_SPACE || char === Query.CHAR_COMMA) {
                canBeIgnored = true;
            }

            if (canBeIgnored) {
                if (isStringStack) {
                    return currentParam + char;
                }
            } else {
                return currentParam + char;
            }

            return currentParam;
        }

        static isQuote(char) {
            return char === Query.CHAR_SINGLE_QUOTE
                || char === Query.CHAR_DOUBLE_QUOTE;
        }

        static isSpecialChar(char) {
            return char === Query.CHAR_COMMA
                || char === Query.CHAR_BRACKET_END
                || char === Query.CHAR_BRACKET_START
                || char === Query.CHAR_DOUBLE_QUOTE
                || char === Query.CHAR_SINGLE_QUOTE;
        }
    }

    try {
        let result = Query.parse('equal("name", "John")');
        console.log(JSON.stringify(result));

        result = Query.parse('equal("name", ["John"])');
        console.log(JSON.stringify(result));

        result = Query.parse('between("name",5, 10)');
        console.log(JSON.stringify(result));

        result = Query.parse('equal("name", ["John"])');
        console.log(JSON.stringify(result));

        result = Query.parse('greaterThan("count", 100)');
        console.log(JSON.stringify(result));
    } catch (error) {
        console.error(error.message);
    }
