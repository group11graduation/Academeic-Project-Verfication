export const PROJECT_STACK_OPTIONS = [
  { value: '', label: 'General project (auto-detect on preview)' },
  { value: 'static-html', label: 'HTML + CSS only' },
  { value: 'static-html-js', label: 'HTML + CSS + JavaScript' },
  { value: 'node-js', label: 'React with Node.js' },
  { value: 'java-spring-react', label: 'React with Spring Boot' },
  { value: 'php-apache', label: 'PHP and MySQL' },
];

export const PROJECT_STACK_HINT_HELP = {
  'static-html':
    'ZIP must include index.html and .css files (no .js). Example: index.html, styles.css, about.html',
  'static-html-js':
    'ZIP must include index.html, .css, and .js files. Example: index.html, style.css, script.js',
  'node-js':
    'Include frontend and backend folders with package.json (e.g. client/ + server/ or a single React + Express app).',
  'java-spring-react':
    'Include Spring Boot backend (pom.xml or build.gradle) and React frontend (package.json) as sibling folders in the ZIP.',
  'php-apache':
    'Include index.php and PHP source files. MySQL scripts or config are optional but recommended for database projects.',
};
