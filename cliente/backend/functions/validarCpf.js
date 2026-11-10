function validarCPF(cpf) {
    if (!cpf) return false;
    
    const cpfLimpo = cpf.replace(/[^\d]/g, '');

    if (cpfLimpo.length !== 11 || /^(\d)\1{10}$/.test(cpfLimpo)) {
        return false;
    }

    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digito1 = (resto >= 10) ? 0 : resto;

    if (digito1 !== parseInt(cpfLimpo.charAt(9))) {
        return false;
    }

    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digito2 = (resto >= 10) ? 0 : resto;

    if (digito2 !== parseInt(cpfLimpo.charAt(10))) {
        return false;
    }

    return true;
}

module.exports = { validarCPF };