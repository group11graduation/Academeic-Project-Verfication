export const PROJECT_STACK_OPTIONS = [
  { value: '', label: 'General project (auto-detect on preview)' },
  { value: 'static-html', label: 'HTML + CSS only' },
  { value: 'static-html-js', label: 'HTML + CSS + JavaScript' },
  { value: 'node-js', label: 'React + Express (MongoDB)' },
  { value: 'node-js-mysql', label: 'React + Express + MySQL' },
  { value: 'java-spring-react', label: 'React + Spring Boot' },
  { value: 'java-spring-thymeleaf', label: 'Spring Boot + Thymeleaf' },
  { value: 'php-apache', label: 'PHP and MySQL' },
];

export const PROJECT_STACK_HINT_HELP = {
  'static-html':
    'ZIP must include index.html and .css files (no .js). Example: index.html, styles.css, about.html',
  'static-html-js':
    'ZIP must include index.html, .css, and .js files. Example: index.html, style.css, script.js',
  'node-js':
    'React + Express with MongoDB/Mongoose. Include frontend and backend folders with package.json (e.g. client/ + server/).',
  'node-js-mysql':
    'React + Express with MySQL (mysql2 / sequelize / prisma mysql — not MongoDB). Include frontend + backend package.json folders. Preview starts a MySQL sidecar automatically.',
  'java-spring-react':
    'React + Spring Boot only (not Express). Include Spring Boot backend (pom.xml or build.gradle) and React frontend (package.json) as sibling folders in the ZIP.',
  'java-spring-thymeleaf':
    'Spring Boot + Thymeleaf (no React). Include pom.xml (or Gradle), Java sources, and HTML templates under src/main/resources/templates. Preview runs the app on port 8080.',
  'php-apache':
    'Include index.php and PHP source files. MySQL scripts or config are optional but recommended for database projects.',
};
