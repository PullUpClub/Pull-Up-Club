module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-tailwindcss'
  ],
  plugins: [
    'stylelint-order'
  ],
  rules: {
    // Prevent problematic patterns that can cause stacking context issues
    'declaration-no-important': null, // Allow !important since you use it strategically
    'selector-class-pattern': null, // Allow Tailwind's utility classes
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'variants',
          'responsive',
          'screen',
          'supports'
        ]
      }
    ],
    
    // Order properties for better readability and maintenance
    'order/properties-order': [
      [
        // Positioning
        'position',
        'top',
        'right',
        'bottom',
        'left',
        'z-index',
        
        // Display & Box Model
        'display',
        'flex',
        'flex-direction',
        'flex-wrap',
        'justify-content',
        'align-items',
        'align-content',
        'grid',
        'grid-template-columns',
        'grid-template-rows',
        'grid-gap',
        'gap',
        
        // Box sizing
        'box-sizing',
        'width',
        'height',
        'min-width',
        'min-height',
        'max-width',
        'max-height',
        
        // Spacing
        'margin',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'padding',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        
        // Visual
        'background',
        'background-color',
        'background-image',
        'background-repeat',
        'background-position',
        'background-size',
        'background-clip',
        'border',
        'border-radius',
        'box-shadow',
        
        // Typography
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'color',
        'text-align',
        'text-decoration',
        
        // Other
        'opacity',
        'visibility',
        'overflow',
        'transform',
        'transition',
        'animation'
      ],
      {
        unspecified: 'bottom',
        emptyLineBeforeUnspecified: 'never'
      }
    ],

    // Prevent problematic z-index usage
    'declaration-property-value-no-unknown': true,
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['env', 'theme'] // Allow Tailwind and CSS env functions
      }
    ],

    // Help prevent stacking context issues
    'declaration-block-no-duplicate-properties': [
      true,
      {
        ignore: ['consecutive-duplicates-with-different-values']
      }
    ],

    // Allow vendor prefixes for browser compatibility
    'property-no-vendor-prefix': null,

    // Encourage consistent naming and prevent typos
    'property-no-unknown': true,
    'unit-no-unknown': true,
    'color-no-invalid-hex': true,

    // Performance and best practices
    'shorthand-property-no-redundant-values': true,
    'declaration-block-no-shorthand-property-overrides': true,
    
    // Formatting rules for consistency
    'color-hex-length': 'short',

    // Media queries
    'media-feature-name-no-unknown': true,
    'custom-media-pattern': '^([a-z][a-z0-9]*)(-[a-z0-9]+)*$',

    // Specificity and selector guidelines
    'selector-max-id': 1,
    'selector-max-universal': 1,
    'selector-max-compound-selectors': 4,
    'selector-no-qualifying-type': [
      true,
      {
        ignore: ['attribute', 'class']
      }
    ],

    // Disable rules that conflict with Tailwind
    'value-keyword-case': null,
    'function-name-case': null
  },
  
  overrides: [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      customSyntax: 'postcss-styled-syntax'
    }
  ],
  ignoreFiles: [
    'node_modules/**/*',
    'dist/**/*',
    'build/**/*'
  ]
};
