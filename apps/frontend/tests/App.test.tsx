import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

describe('App', () => {
  it('renderiza la página de login por defecto', () => {
    render(<App />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});
