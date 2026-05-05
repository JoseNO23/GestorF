use serde::{Deserialize, Serialize};
use std::{
    fmt,
    ops::{Add, AddAssign, Neg, Sub, SubAssign},
};

/// Representa un monto monetario en centavos (entero).
/// Nunca usar f64 para aritmética financiera.
/// S/ 10.50 = Money(1050)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Money(i64);

impl Money {
    pub const ZERO: Money = Money(0);

    pub fn from_minor(centavos: i64) -> Self {
        Money(centavos)
    }

    pub fn to_minor(self) -> i64 {
        self.0
    }

    /// Parsea input del usuario: "10.50" → Money(1050), "1000" → Money(100000).
    /// Acepta hasta 2 decimales; trunca el resto. Acepta negativos.
    pub fn from_input(s: &str) -> Result<Self, String> {
        let s = s.trim().replace(',', "");
        let negative = s.starts_with('-');
        let s = s.trim_start_matches('-');

        let centavos: i64 = match s.split_once('.') {
            Some((int_part, dec_part)) => {
                let int_val: i64 = int_part
                    .parse()
                    .map_err(|_| format!("monto inválido: {s}"))?;
                let dec_str = format!("{:0<2}", &dec_part[..dec_part.len().min(2)]);
                let dec_val: i64 = dec_str
                    .parse()
                    .map_err(|_| format!("decimal inválido: {s}"))?;
                int_val * 100 + dec_val
            }
            None => {
                let int_val: i64 = s
                    .parse()
                    .map_err(|_| format!("monto inválido: {s}"))?;
                int_val * 100
            }
        };

        Ok(Money(if negative { -centavos } else { centavos }))
    }

    /// Formatea para mostrar al usuario: Money(1050) → "S/ 10.50"
    pub fn display(self) -> String {
        let abs = self.0.unsigned_abs();
        let sign = if self.0 < 0 { "-" } else { "" };
        format!("{}S/ {}.{:02}", sign, abs / 100, abs % 100)
    }

    pub fn is_zero(self) -> bool {
        self.0 == 0
    }

    pub fn is_negative(self) -> bool {
        self.0 < 0
    }

    pub fn abs(self) -> Self {
        Money(self.0.abs())
    }
}

impl Add for Money {
    type Output = Money;
    fn add(self, rhs: Money) -> Money {
        Money(self.0 + rhs.0)
    }
}

impl Sub for Money {
    type Output = Money;
    fn sub(self, rhs: Money) -> Money {
        Money(self.0 - rhs.0)
    }
}

impl AddAssign for Money {
    fn add_assign(&mut self, rhs: Money) {
        self.0 += rhs.0;
    }
}

impl SubAssign for Money {
    fn sub_assign(&mut self, rhs: Money) {
        self.0 -= rhs.0;
    }
}

impl Neg for Money {
    type Output = Money;
    fn neg(self) -> Money {
        Money(-self.0)
    }
}

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display())
    }
}

impl Default for Money {
    fn default() -> Self {
        Money::ZERO
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_minor_roundtrip() {
        assert_eq!(Money::from_minor(1050).to_minor(), 1050);
        assert_eq!(Money::from_minor(0).to_minor(), 0);
        assert_eq!(Money::from_minor(-500).to_minor(), -500);
    }

    #[test]
    fn display_formatea_correctamente() {
        assert_eq!(Money::from_minor(1050).display(), "S/ 10.50");
        assert_eq!(Money::from_minor(100).display(), "S/ 1.00");
        assert_eq!(Money::from_minor(5).display(), "S/ 0.05");
        assert_eq!(Money::from_minor(0).display(), "S/ 0.00");
        assert_eq!(Money::from_minor(-500).display(), "-S/ 5.00");
    }

    #[test]
    fn suma_usa_enteros() {
        assert_eq!((Money::from_minor(1050) + Money::from_minor(50)).to_minor(), 1100);
        assert_eq!((Money::from_minor(1) + Money::from_minor(2)).to_minor(), 3);
    }

    #[test]
    fn resta_puede_ser_negativa() {
        assert_eq!((Money::from_minor(100) - Money::from_minor(150)).to_minor(), -50);
        assert_eq!((Money::from_minor(500) - Money::from_minor(500)).to_minor(), 0);
    }

    #[test]
    fn negacion() {
        assert_eq!((-Money::from_minor(300)).to_minor(), -300);
        assert_eq!((-Money::from_minor(-300)).to_minor(), 300);
    }

    #[test]
    fn parsea_input_del_usuario() {
        assert_eq!(Money::from_input("10.50").unwrap().to_minor(), 1050);
        assert_eq!(Money::from_input("1000").unwrap().to_minor(), 100000);
        assert_eq!(Money::from_input("0.01").unwrap().to_minor(), 1);
        assert_eq!(Money::from_input("0.10").unwrap().to_minor(), 10);
        assert_eq!(Money::from_input("10.5").unwrap().to_minor(), 1050);
        assert_eq!(Money::from_input("-5.00").unwrap().to_minor(), -500);
        assert_eq!(Money::from_input("1,000.50").unwrap().to_minor(), 100050);
    }

    #[test]
    fn parseo_invalido_retorna_error() {
        assert!(Money::from_input("abc").is_err());
        assert!(Money::from_input("").is_err());
    }

    #[test]
    fn add_assign_y_sub_assign() {
        let mut total = Money::ZERO;
        total += Money::from_minor(500);
        total += Money::from_minor(300);
        assert_eq!(total.to_minor(), 800);
        total -= Money::from_minor(200);
        assert_eq!(total.to_minor(), 600);
    }
}
