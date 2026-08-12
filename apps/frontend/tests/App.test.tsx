import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  });
}

describe('App', () => {
  it('renderiza la pantalla de login por defecto', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Inicio de sesion' })).toBeInTheDocument();
  });

  it('HU-01 muestra confirmacion al registrar paciente', async () => {
    window.history.pushState({}, '', '/register');
    mockJsonResponse({ message: 'Registro completado. Ya puede iniciar sesion.' }, true, 201);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Mora' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'ana@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'Segura123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText(/Registro completado/)).toBeInTheDocument();
  });

  it('HU-02 muestra rechazo cuando las credenciales son incorrectas', async () => {
    mockJsonResponse({ error: 'Credenciales incorrectas.' }, false, 401);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'ana@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'mala' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Credenciales incorrectas.')).toBeInTheDocument();
  });

  it('HU-03 muestra confirmacion de envio de recuperacion', async () => {
    window.history.pushState({}, '', '/forgot-password');
    mockJsonResponse({ message: 'Si el correo existe, se envio un enlace de recuperacion.' });
    render(<App />);

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'ana@medtrack.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText(/se envio un enlace/)).toBeInTheDocument();
  });

  it('HU-03 permite enviar nueva contrasena desde la pantalla de reset', async () => {
    window.history.pushState({}, '', '/reset-password?token=valid-token-with-enough-length');
    mockJsonResponse({ message: 'Contrasena actualizada correctamente.' });
    render(<App />);

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Contrasena actualizada correctamente.')).toBeInTheDocument();
  });

  it('HU-04 muestra confirmacion al registrar medico', async () => {
    localStorage.setItem('medtrack.token', 'token-admin');
    localStorage.setItem(
      'medtrack.user',
      JSON.stringify({ id: 'admin-1', email: 'admin@test.local', nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' })
    );
    window.history.pushState({}, '', '/admin/doctors');
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Pediatria' }] });
    mockJsonResponse({ message: 'Medico registrado correctamente.' }, true, 201);
    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/especialidades'), expect.anything()));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Medico registrado correctamente.')).toBeInTheDocument();
  });
});
