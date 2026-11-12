
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Mini CAD</title>
    @vite(['resources/css/app.css'])
</head>
<body class="auth-page">
    <main class="auth-card">
        <div class="auth-brand">
            <span class="auth-brand-mark" aria-hidden="true">⌑</span>
            <div><p class="auth-brand-title">Mini CAD Editor</p><p class="auth-brand-subtitle">Engineering workspace</p></div>
        </div>
        <h1>Welcome back</h1>
        <p class="auth-intro">Log in to continue to your workspace.</p>

    <form method="POST" action="{{ route('login') }}">
        @csrf

        <div class="auth-field">
            <label for="email">Email</label>
            <input
                type="email"
                id="email"
                name="email"
                autocomplete="email"
                @error('email') aria-invalid="true" aria-describedby="email-error" @enderror
                value="{{ old('email') }}"
                required
            >
            @error('email')
                <p class="auth-error" id="email-error">{{ $message }}</p>
            @enderror
        </div>

        <div class="auth-field">
            <label for="password">Password</label>
            <input
                type="password"
                id="password"
                name="password"
                autocomplete="current-password"
                @error('password') aria-invalid="true" aria-describedby="password-error" @enderror
                required
            >
            @error('password')
                <p class="auth-error" id="password-error">{{ $message }}</p>
            @enderror
        </div>

        <button type="submit">Login</button>
    </form>

    <p class="auth-switch">
        Don't have an account?
        <a href="{{ route('register') }}">Register</a>
    </p>
    </main>
</body>
</html>
