/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // A new feature
        'fix', // A bug fix
        'docs', // Documentation only
        'style', // Changes that do not affect code meaning
        'refactor', // A code change that neither fixes a bug nor adds a feature
        'perf', // A code change that improves performance
        'test', // Adding missing or updating tests
        'chore', // Changes to build process, dependencies
        'ci', // Changes to CI/CD configuration
        'security', // Security improvements or fixes
        'a11y', // Accessibility improvements
        'revert', // Reverts a previous commit
      ],
    ],
    'type-case': [2, 'always', 'lowercase'],
    'type-empty': [2, 'never'],
    'scope-empty': [2, 'never'],
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },

  prompt: {
    questions: {
      type: {
        description: "Select the type of change that you're committing:",
        enum: {
          feat: {
            description: '✨ A new feature',
            title: 'Features',
            emoji: '✨',
          },
          fix: {
            description: '🐛 A bug fix',
            title: 'Bug Fixes',
            emoji: '🐛',
          },
          docs: {
            description: '📖 Documentation only changes',
            title: 'Documentation',
            emoji: '📖',
          },
          style: {
            description: '💅 Changes that do not affect code meaning (formatting, etc)',
            title: 'Styles',
            emoji: '💅',
          },
          refactor: {
            description: '♻️ A code change that neither fixes a bug nor adds a feature',
            title: 'Code Refactoring',
            emoji: '♻️',
          },
          perf: {
            description: '⚡ A code change that improves performance',
            title: 'Performance Improvements',
            emoji: '⚡',
          },
          test: {
            description: '✅ Adding missing tests or correcting existing tests',
            title: 'Tests',
            emoji: '✅',
          },
          chore: {
            description: '🔧 Changes to build process, dependencies, tooling, etc',
            title: 'Chores',
            emoji: '🔧',
          },
          ci: {
            description: '🤖 Changes to CI/CD configuration and scripts',
            title: 'CI/CD',
            emoji: '🤖',
          },
          security: {
            description: '🔒 Security improvements or fixes',
            title: 'Security',
            emoji: '🔒',
          },
          a11y: {
            description: '♿ Accessibility improvements',
            title: 'Accessibility',
            emoji: '♿',
          },
          revert: {
            description: '🔙 Reverts a previous commit',
            title: 'Reverts',
            emoji: '🔙',
          },
        },
      },
      scope: {
        description: 'What is the scope of this change (e.g., auth, payment, ui):',
        maxHeaderLength: 100,
      },
      subject: {
        description: 'Write a short, imperative tense description of the change:',
        maxHeaderLength: 100,
      },
      body: {
        description:
          'Provide a longer description of the changes (optional). Use "|" to break new line:\n',
        maxLineLength: 100,
      },
      isBreaking: {
        description: 'Are there any breaking changes?',
      },
      breakingBody: {
        description:
          'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself:\n',
        maxLineLength: 100,
      },
      breaking: {
        description: 'Describe the breaking changes:\n',
        maxLineLength: 100,
      },
      isIssueAffected: {
        description: 'Does this change affect any open issues?',
      },
      issuesBody: {
        description:
          'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself:\n',
        maxLineLength: 100,
      },
      issues: {
        description: 'Add issue references (e.g., "fixes #123", "refs #456"):',
        maxLineLength: 100,
      },
    },
    messages: {
      type: "Select the type of change you're committing:",
      scope: '\nDenote the SCOPE of this change (optional):',
      customScope: 'Denote the SCOPE of this change:',
      subject: 'Write a SHORT, imperative tense description of the change:\n',
      body: 'Provide a LONGER description of the changes (optional). Use "|" to break new line:\n',
      breaking: 'List any BREAKING CHANGES (optional):\n',
      breakingBody:
        'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself:\n',
      issues: 'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34:\n',
      issuesBody:
        'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself:\n',
      confirmCommit: 'Are you sure you want to proceed with the commit above?',
    },
    settings: {
      enableMultipleScopes: false,
      scopeEnumSeparator: ',',
      defaultBody: '',
      defaultIssues: '',
      defaultScope: '',
      defaultSubject: '',
      defaultType: '',
      upperCaseSubject: false,
      maxHeaderLength: Infinity,
      maxLineLength: 100,
      minHeaderLength: 0,
      scopeEnumSeparator: ',',
    },
  },
};

module.exports = config;
