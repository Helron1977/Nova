// Ce fichier peut être utilisé pour des configurations globales de tests Vitest.
// Par exemple, importer des polyfills, configurer des mocks globaux, etc. 

// import matchers from '@testing-library/jest-dom/matchers';
// import { expect } from 'vitest';
// expect.extend(matchers);

// Méthode d'importation recommandée qui étend globalement expect :
import '@testing-library/jest-dom';

// Autres setups globaux peuvent aller ici (ex: mocks globaux)

console.log('Test setup file (setupTests.ts) loaded.'); 