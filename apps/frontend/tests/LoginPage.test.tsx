import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

import { AuthProvider } from '../src/context/AuthContext';
import { LoginPage } from '../src/pages/auth/LoginPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

function fillAndSubmit(email = 'ana@medtrack.test', password = 'Segura123') {
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  it('HU-02 autentica con credenciales validas', async () => {
    mockJsonResponse({
      token: 'token-1',
      usuario: { id: 'user-1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' },
    });
    renderLogin();
    fillAndSubmit();

    expect(await screen.findByText(/inicio de sesion exitoso/i)).toBeInTheDocument();
  });

  it('HU-02 rechaza credenciales incorrectas mostrando el mensaje del backend', async () => {
    mockJsonResponse({ error: 'Correo o contraseña incorrectos. Intento 2 de 5.' }, false, 401);
    renderLogin();
    fillAndSubmit();

    expect(await screen.findByText('Correo o contraseña incorrectos. Intento 2 de 5.')).toBeInTheDocument();
  });

  it('HU-02 muestra el mensaje de bloqueo que devuelve el backend', async () => {
    mockJsonResponse({ error: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' }, false, 403);
    renderLogin();
    fillAndSubmit();

    expect(
      await screen.findByText('Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.')
    ).toBeInTheDocument();
  });
});
