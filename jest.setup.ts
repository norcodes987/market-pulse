import '@testing-library/jest-dom';

// Polyfill fetch in jsdom environment
if (!global.fetch) {
  global.fetch = jest.fn();
}
