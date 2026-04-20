'use strict';
// Redirect all `import jQuery from 'jquery'` to the global instance
// loaded via <script> tag, so that jQuery plugins (DataTables, Fancytree,
// jquery-ui) all extend the same object.
export default window.jQuery;
export const jQuery = window.jQuery;
