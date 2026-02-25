# Общая архитектура: 
(Ngingx), REST, NODE.JS, БД (PostgreSQL/MySQL), интеграции DaData, Google oAuth2

@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

title Fairate MVP — System Context Diagram

Person(customer, "Заказчик", "Импортёр/экспортёр. Создаёт заявки на перевозку.")

Person(logist, "Логист", "Экспедитор / ТК. Предлагает ставки по заявкам или загружает маршруты заранее.")

```mermaid
System_Boundary(fairate_boundary, "Fairate Platform (MVP)") {
    System(customer_fe, "customer FE", "Фронтенд заказчика")
    System(logist_fe, "logist FE", "Фронтенд Логистов")
    System(be, "backend","бизнес логика", "Node.JS")
    ContainerDb(db, "PostgreSQL",  "Database", "Основаная БД чтение и запись")
    Container(nginx, "NGINX", "Port :443", "балансировка и маршрутизация)")
}

    System_Ext(google_auth, "Google OAuth", "Аутентификация через Google")
    System_Ext(dadata, "DaData API", "Валидация ИНН, адресов, городов")



Rel(customer, customer_fe, "создаёт/редактирует заявки, просматривает предложения", "HTTP/HTTPS")
Rel(logist, logist_fe, "загружает маршруты, отвечает на заявки", "HTTP/HTTPS")


Rel(customer_fe, google_auth, "Авторизация / регистрация", "OAuth2")
Rel(logist_fe, google_auth, "Авторизация / регистрация", "OAuth2")

Rel(customer_fe, nginx, "")
Rel(logist_fe, nginx, "")

Rel(nginx, be, "")

Rel(be, db, "Запись данных")
Rel(db, be, "Чтениеданных")


Rel(customer_fe, dadata, "Валидация компании (ИНН), городов", "API")
Rel(logist_fe, dadata, "валидация данных", "API")

@enduml
```