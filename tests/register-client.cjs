// Node SSR fixtures do not load styles. This hook is only used by client-render tests.
require.extensions['.css'] = () => {};
